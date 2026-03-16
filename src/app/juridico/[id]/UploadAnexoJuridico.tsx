"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerJuridicoAnexo } from "../actions";

export function UploadAnexoJuridico({
  ticketId,
  lado,
  onSuccess,
}: {
  ticketId: string;
  lado: "frank" | "moni";
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ticketId}/${lado}/${crypto.randomUUID()}_${safeName}`;

    const { error: uploadErr } = await supabase.storage.from("juridico-anexos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadErr) {
      setError(uploadErr.message);
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const result = await registerJuridicoAnexo(ticketId, path, file.name, file.size, lado);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        onChange={handleFileChange}
        disabled={loading}
        className="block w-full text-sm text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-moni-light file:px-3 file:py-1.5 file:text-moni-accent file:font-medium"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-1 text-sm text-stone-500">Enviando...</p>}
    </div>
  );
}
