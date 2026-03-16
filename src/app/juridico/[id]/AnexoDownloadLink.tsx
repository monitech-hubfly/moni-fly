"use client";

import { useState } from "react";
import { getJuridicoAnexoDownloadUrl } from "../actions";

export function AnexoDownloadLink({ anexoId, fileName }: { anexoId: string; fileName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await getJuridicoAnexoDownloadUrl(anexoId);
    setLoading(false);
    if (result.ok) window.open(result.url, "_blank");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-moni-accent hover:underline disabled:opacity-50"
    >
      {loading ? "Gerando link..." : fileName}
    </button>
  );
}
