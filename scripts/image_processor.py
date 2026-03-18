import os
import shutil
from PIL import Image
import json

# Configuration
SOURCE_PEOPLE = r"G:\내 드라이브\03. Business\서울연세학원\인물사진"
SOURCE_ACADEMY = r"G:\내 드라이브\03. Business\서울연세학원\학원사진"
TARGET_BASE = r"c:\Users\Bijou\.gemini\Hames\Sales\SeoulYonsei.Admin\public\images"
METADATA_FILE = os.path.join(TARGET_BASE, "assets-metadata.json")

# Categories mapping
CATEGORIES = {
    "lecturers": os.path.join(TARGET_BASE, "lecturers"),
    "facilities": os.path.join(TARGET_BASE, "facilities"),
    "branding": os.path.join(TARGET_BASE, "branding")
}

def ensure_dirs():
    for path in CATEGORIES.values():
        if not os.path.exists(path):
            os.makedirs(path)

def process_image(src_path, dest_folder, new_name):
    try:
        with Image.open(src_path) as img:
            # Convert to RGB if necessary (for WebP/JPEG)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Smart Resize (Max width 1920 for quality vs performance)
            max_size = 1920
            if img.width > max_size:
                ratio = max_size / float(img.width)
                new_height = int(float(img.height) * ratio)
                img = img.resize((max_size, new_height), Image.Resampling.LANCZOS)
            
            dest_path = os.path.join(dest_folder, new_name + ".webp")
            img.save(dest_path, "WEBP", quality=85)
            return dest_path
    except Exception as e:
        print(f"Error processing {src_path}: {e}")
        return None

def run():
    print("Starting SEOUL YONSEI Image Asset Processing...")
    ensure_dirs()
    metadata = []

    # 1. Process People (인물사진)
    print("Processing Lecturer photos...")
    for root, dirs, files in os.walk(SOURCE_PEOPLE):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                tag = "group"
                if "국어" in file: tag = "korean"
                elif "수학" in file: tag = "math"
                elif "2인" in file: tag = "directors"
                
                new_name = f"lec_{file.split('.')[0]}"
                src = os.path.join(root, file)
                saved_path = process_image(src, CATEGORIES["lecturers"], new_name)
                
                if saved_path:
                    metadata.append({
                        "id": new_name,
                        "category": "PEOPLE",
                        "tag": tag,
                        "path": f"/images/lecturers/{new_name}.webp",
                        "original_name": file
                    })

    # 2. Process Academy (학원사진)
    print("Processing Academy facility photos...")
    for root, dirs, files in os.walk(SOURCE_ACADEMY):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                tag = "general"
                if "외경" in file: tag = "exterior"
                elif "입구" in file: tag = "entrance"
                elif "자습실" in file: tag = "study_room"
                elif "국어" in file or "수학" in file: tag = "classroom"
                
                new_name = f"fac_{file.split('.')[0]}"
                src = os.path.join(root, file)
                saved_path = process_image(src, CATEGORIES["facilities"], new_name)
                
                if saved_path:
                    metadata.append({
                        "id": new_name,
                        "category": "FACILITY",
                        "tag": tag,
                        "path": f"/images/facilities/{new_name}.webp",
                        "original_name": file
                    })

    # Save Metadata
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully processed {len(metadata)} images.")
    print(f"Metadata saved to {METADATA_FILE}")

if __name__ == "__main__":
    run()
