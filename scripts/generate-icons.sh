#!/bin/bash
#
# Nova Seller Icon Generator
#
# Generates application icons in multiple sizes for macOS, Windows, and Linux.
# Requires: ImageMagick (brew install imagemagick) or sips (built-in on macOS)
#
# Usage: ./generate-icons.sh [source_image] [output_dir]
#

set -e

# Default values
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOURCE_IMAGE="${1:-$PROJECT_ROOT/nova-browser-icon-v3.png}"
OUTPUT_DIR="${2:-$PROJECT_ROOT/resources/icons}"

# Icon sizes for various platforms
ICON_SIZES=(16 32 48 64 128 256 512 1024)

# macOS iconset sizes (need @2x variants)
MACOS_SIZES=(16 32 128 256 512)

echo "Nova Seller Icon Generator"
echo "=========================="
echo "Source: $SOURCE_IMAGE"
echo "Output: $OUTPUT_DIR"
echo ""

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to check if ImageMagick is available
has_imagemagick() {
    command -v convert &> /dev/null
}

# Function to check if sips is available (macOS)
has_sips() {
    command -v sips &> /dev/null
}

# Function to resize image using ImageMagick
resize_with_imagemagick() {
    local input="$1"
    local output="$2"
    local size="$3"
    magick "$input" -resize "${size}x${size}" -quality 100 "$output"
}

# Function to resize image using sips (macOS)
resize_with_sips() {
    local input="$1"
    local output="$2"
    local size="$3"
    cp "$input" "$output"
    sips -z "$size" "$size" "$output" > /dev/null 2>&1
}

# Choose resize function
if has_imagemagick; then
    echo "Using ImageMagick for image processing"
    resize_image() {
        resize_with_imagemagick "$@"
    }
elif has_sips; then
    echo "Using sips for image processing (macOS)"
    resize_image() {
        resize_with_sips "$@"
    }
else
    echo "Error: Neither ImageMagick nor sips found"
    echo "Please install ImageMagick: brew install imagemagick"
    exit 1
fi

echo ""
echo "Generating PNG icons..."
echo "-----------------------"

# Generate standard PNG sizes
for size in "${ICON_SIZES[@]}"; do
    output_file="$OUTPUT_DIR/icon_${size}x${size}.png"
    echo "  Generating ${size}x${size}..."
    resize_image "$SOURCE_IMAGE" "$output_file" "$size"
done

# Copy original as highest quality
cp "$SOURCE_IMAGE" "$OUTPUT_DIR/icon_original.png"

echo ""
echo "Generating macOS iconset..."
echo "---------------------------"

# Create macOS iconset directory
ICONSET_DIR="$OUTPUT_DIR/NovaSeller.iconset"
mkdir -p "$ICONSET_DIR"

# Generate macOS iconset (needs specific naming convention)
for size in "${MACOS_SIZES[@]}"; do
    # Standard resolution
    echo "  icon_${size}x${size}.png"
    resize_image "$SOURCE_IMAGE" "$ICONSET_DIR/icon_${size}x${size}.png" "$size"

    # @2x (Retina) resolution
    double_size=$((size * 2))
    echo "  icon_${size}x${size}@2x.png"
    resize_image "$SOURCE_IMAGE" "$ICONSET_DIR/icon_${size}x${size}@2x.png" "$double_size"
done

# Generate .icns file if iconutil is available (macOS only)
if command -v iconutil &> /dev/null; then
    echo ""
    echo "Generating macOS .icns file..."
    iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_DIR/NovaSeller.icns"
    echo "  Created NovaSeller.icns"
else
    echo ""
    echo "Note: iconutil not available (not on macOS), skipping .icns generation"
    echo "  You can generate .icns on macOS using: iconutil -c icns $ICONSET_DIR"
fi

echo ""
echo "Generating Windows .ico file..."
echo "-------------------------------"

# Generate Windows ICO file
if has_imagemagick; then
    ICO_SIZES=(16 32 48 64 128 256)
    ICO_INPUTS=()

    for size in "${ICO_SIZES[@]}"; do
        ico_png="$OUTPUT_DIR/temp_ico_${size}.png"
        resize_image "$SOURCE_IMAGE" "$ico_png" "$size"
        ICO_INPUTS+=("$ico_png")
    done

    # Create ICO file with multiple resolutions
    magick "${ICO_INPUTS[@]}" "$OUTPUT_DIR/NovaSeller.ico"
    echo "  Created NovaSeller.ico"

    # Clean up temp files
    rm -f "$OUTPUT_DIR"/temp_ico_*.png
else
    echo "Note: ImageMagick required for .ico generation"
    echo "  Install with: brew install imagemagick"
fi

echo ""
echo "Generating favicon..."
echo "--------------------"

# Generate favicon
resize_image "$SOURCE_IMAGE" "$OUTPUT_DIR/favicon.ico" 32
resize_image "$SOURCE_IMAGE" "$OUTPUT_DIR/favicon-16x16.png" 16
resize_image "$SOURCE_IMAGE" "$OUTPUT_DIR/favicon-32x32.png" 32
resize_image "$SOURCE_IMAGE" "$OUTPUT_DIR/apple-touch-icon.png" 180

echo "  Created favicon files"

echo ""
echo "Summary"
echo "======="
echo "Generated icons in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"

echo ""
echo "Done!"
