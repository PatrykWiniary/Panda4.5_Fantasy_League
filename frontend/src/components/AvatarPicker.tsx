import { useEffect, useMemo, useState } from "react";
import type { ProfileAvatarOption } from "../utils/profileAvatars";
import { PROFILE_AVATAR_OPTIONS } from "../utils/profileAvatars";

type AvatarPickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
  options?: ProfileAvatarOption[];
  pageSize?: number;
};

export default function AvatarPicker({
  value,
  onChange,
  disabled = false,
  title,
  options = PROFILE_AVATAR_OPTIONS,
  pageSize = 15,
}: AvatarPickerProps) {
  const safePageSize = Math.max(1, pageSize);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [options.length, safePageSize]);

  const totalPages = Math.max(
    1,
    Math.ceil(options.length / safePageSize)
  );
  const visibleOptions = useMemo(
    () =>
      options.slice(page * safePageSize, page * safePageSize + safePageSize),
    [options, page, safePageSize]
  );

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <div className="avatar-picker-wrapper">
      {title && <p className="avatar-picker-title">{title}</p>}
      <div className="avatar-picker-grid">
        {visibleOptions.map((option) => (
          <button
            type="button"
            key={option.key}
            className={`avatar-option ${value === option.key ? "selected" : ""}`}
            onClick={() => onChange(option.key)}
            disabled={disabled}
          >
            <img src={option.image} alt={option.label} />
            <span className="avatar-option-label">{option.label}</span>
          </button>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="avatar-picker-pagination">
          <button
            type="button"
            className="avatar-picker-nav"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={!canPrev || disabled}
          >
            ← Prev
          </button>
          <span className="avatar-picker-page-indicator">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="avatar-picker-nav"
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={!canNext || disabled}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
