export async function uploadFile(file: File, roleId: string, fieldName: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("roleId", roleId);
  fd.append("fieldName", fieldName);

  const res = await fetch("/api/recruitment/upload", {
    method: "POST",
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Upload failed");
  if (!data?.success) throw new Error(data?.error ?? "Upload failed");
  return data as {
    success: true;
    url: string;
    driveFileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
}