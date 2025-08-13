#!/usr/bin/env python3
"""
Script to create simple PNG icons for the Chrome extension.
Creates 16x16, 48x48, and 128x128 pixel icons with a markdown symbol.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    # Create a new image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill=(26, 115, 232, 255), outline=None)
    
    # Draw "M" for Markdown in the center
    font_size = size // 2
    try:
        # Try to use a system font
        font = ImageFont.truetype("Arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
        except:
            # Fallback to default font
            font = ImageFont.load_default()
    
    # Get text dimensions
    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]
    
    # Draw the text
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path}")

def main():
    icons_dir = "/Users/sirkitree/repos/chrome-extensions/google-drive-markdown-preview/icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    # Create icons in different sizes
    sizes = [16, 48, 128]
    for size in sizes:
        output_path = os.path.join(icons_dir, f"icon{size}.png")
        create_icon(size, output_path)

if __name__ == "__main__":
    main()