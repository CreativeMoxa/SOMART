// Shared "who touched this record" columns. Deliberately dependency-free so
// models can use it without pulling in next/headers or the auth stack.
//
// Combined with mongoose `timestamps: true`, every record then carries:
//   Created By (createdBy) / Created Date (createdAt)
//   Last Updated By (updatedBy) / Last Updated Date (updatedAt)
export const auditFields = {
  createdBy: { type: String, default: "" },
  updatedBy: { type: String, default: "" },
};
