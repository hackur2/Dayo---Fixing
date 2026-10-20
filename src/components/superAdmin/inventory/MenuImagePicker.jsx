import { useRef, useState } from "react";

import { isSupabaseConfigured, supabase } from "../../../lib/supabase";

const IMAGE_BUCKET = "menu-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function MenuImagePicker({ imageUrl, imageFileName, onChange }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const isLocalImage = String(imageUrl || "").startsWith("data:image/");
  const pathValue = isLocalImage ? "" : imageUrl || "";

  function handlePathChange(event) {
    setUploadError("");
    onChange({
      imageUrl: event.target.value,
      imageFileName: "",
    });
  }

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setUploadError("Supabase is not configured. Set the project URL and publishable key, then restart the app.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "image";
      const filePath = `${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
      onChange({
        imageUrl: data.publicUrl,
        imageFileName: file.name,
      });
    } catch (error) {
      console.error("Menu image upload failed:", error);
      setUploadError(error.message || "Image upload failed. Check the Storage bucket and upload policy.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="inventory-image-field">
      <span className="inventory-field-label">Image Path / Image File</span>

      <div className="inventory-image-picker-row">
        <input
          type="text"
          value={pathValue}
          onChange={handlePathChange}
          placeholder="/images/menu/example.png or image URL"
          aria-label="Menu image path or URL"
        />

        <button
          type="button"
          className="secondary-button inventory-browse-image-button"
          onClick={handleBrowseClick}
          disabled={isUploading}
        >
          {isUploading ? "Uploading…" : "Browse Image"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="inventory-hidden-file-input"
          onChange={handleFileChange}
          aria-label="Choose menu image from local folder"
        />
      </div>

      <small className="inventory-field-help">
        {uploadError || (imageFileName ? `Uploaded: ${imageFileName}` : "Upload JPG, PNG, or WebP (max 5 MB).")}
      </small>

      {imageUrl && (
        <div className="inventory-image-preview">
          <img src={imageUrl} alt="Selected menu preview" />
        </div>
      )}
    </div>
  );
}

export default MenuImagePicker;
