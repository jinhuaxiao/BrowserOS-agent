#!/usr/bin/env python3
"""CRX3 packing utility for Chrome extensions.

Creates signed CRX3 files from unpacked extension directories using
RSA-2048 keys. Handles key generation, extension ID derivation, and
the full CRX3 binary format including protobuf header encoding.
"""

import base64
import hashlib
import io
import struct
import zipfile
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

CRX3_MAGIC = b"Cr24"
CRX3_VERSION = 3


def generate_key(key_path: Path) -> rsa.RSAPrivateKey:
    """Generate a new RSA-2048 key pair and save to PEM file."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    key_path.parent.mkdir(parents=True, exist_ok=True)
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    key_path.write_bytes(pem)
    return private_key


def load_key(key_path: Path) -> rsa.RSAPrivateKey:
    """Load an RSA private key from PEM file."""
    pem = key_path.read_bytes()
    return serialization.load_pem_private_key(pem, password=None)


def load_or_generate_key(key_path: Path) -> rsa.RSAPrivateKey:
    """Load existing key or generate a new one."""
    if key_path.exists():
        return load_key(key_path)
    return generate_key(key_path)


def get_public_key_der(private_key: rsa.RSAPrivateKey) -> bytes:
    """Get DER-encoded SubjectPublicKeyInfo from private key."""
    return private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def get_public_key_base64(private_key: rsa.RSAPrivateKey) -> str:
    """Get base64-encoded public key for manifest.json key field."""
    return base64.b64encode(get_public_key_der(private_key)).decode()


def derive_extension_id(public_key_der: bytes) -> str:
    """Derive Chrome extension ID from DER-encoded public key.

    Chrome extension IDs are the first 32 characters of the public key's
    SHA-256 hash, encoded using a-p (instead of 0-9a-f).
    """
    digest = hashlib.sha256(public_key_der).digest()
    ext_id = ""
    for byte in digest[:16]:
        ext_id += chr(ord("a") + (byte >> 4))
        ext_id += chr(ord("a") + (byte & 0xF))
    return ext_id


def _encode_varint(value: int) -> bytes:
    """Encode an integer as protobuf varint."""
    result = []
    while value > 0x7F:
        result.append((value & 0x7F) | 0x80)
        value >>= 7
    result.append(value & 0x7F)
    return bytes(result)


def _encode_bytes_field(field_number: int, data: bytes) -> bytes:
    """Encode a bytes field in protobuf wire format (type 2 = length-delimited)."""
    tag = _encode_varint((field_number << 3) | 2)
    length = _encode_varint(len(data))
    return tag + length + data


def _make_crx_file_header(
    public_key_der: bytes, signature: bytes, signed_header_data: bytes
) -> bytes:
    """Create CrxFileHeader protobuf message.

    CrxFileHeader {
      repeated AsymmetricKeyProof sha256_with_rsa = 2;
      bytes signed_header_data = 10000;
    }
    AsymmetricKeyProof { bytes public_key = 1; bytes signature = 2; }
    """
    proof = _encode_bytes_field(1, public_key_der) + _encode_bytes_field(
        2, signature
    )
    header = _encode_bytes_field(2, proof)
    header += _encode_bytes_field(10000, signed_header_data)
    return header


def _create_zip(extension_dir: Path) -> bytes:
    """Create a ZIP archive from an extension directory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(extension_dir.rglob("*")):
            if file_path.is_file():
                arcname = str(file_path.relative_to(extension_dir))
                zf.write(file_path, arcname)
    return buf.getvalue()


def pack_crx3(
    extension_dir: Path, private_key: rsa.RSAPrivateKey, output_path: Path
) -> str:
    """Pack an extension directory into a CRX3 file.

    Returns the extension ID derived from the signing key.
    """
    public_key_der = get_public_key_der(private_key)

    # CRX ID = first 16 bytes of SHA256(public_key_der)
    crx_id = hashlib.sha256(public_key_der).digest()[:16]

    # SignedData { bytes crx_id = 1; }
    signed_header_data = _encode_bytes_field(1, crx_id)

    zip_data = _create_zip(extension_dir)

    # Signature covers: "CRX3 SignedData\x00" + uint32(len) + signed_header_data + zip
    sign_data = b"CRX3 SignedData\x00"
    sign_data += struct.pack("<I", len(signed_header_data))
    sign_data += signed_header_data
    sign_data += zip_data

    signature = private_key.sign(
        sign_data,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )

    header = _make_crx_file_header(public_key_der, signature, signed_header_data)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(CRX3_MAGIC)
        f.write(struct.pack("<I", CRX3_VERSION))
        f.write(struct.pack("<I", len(header)))
        f.write(header)
        f.write(zip_data)

    return derive_extension_id(public_key_der)
