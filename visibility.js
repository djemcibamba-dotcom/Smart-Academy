export function norm(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function studentSeesDocument(student, doc) {
  if (!student || !doc) return false;

  if (doc.source === "administration") {
    if (doc.universite && doc.universite !== student.universite) return false;
    if (doc.audienceType === "section") {
      if (!doc.filiere || !student.filiere) return false;
      const sf = norm(student.filiere);
      const df = norm(doc.filiere);
      if (sf === df || sf.includes(df) || df.includes(sf)) return true;
      return false;
    }
    return true;
  }

  if (doc.source !== "professeur" && doc.source !== "assistant") return false;
  if (doc.audienceType && doc.audienceType !== "ma_classe") return false;

  if (doc.universite && doc.universite !== student.universite) return false;
  if (doc.niveau && doc.niveau !== student.niveau) return false;

  const sf = norm(student.filiere);
  const df = norm(doc.filiere);
  if (df && sf && !sf.includes(df) && !df.includes(sf)) return false;

  return true;
}

export const SOURCE_BY_ROLE = {
  professeur: "professeur",
  assistant: "assistant",
  universite: "administration",
};
