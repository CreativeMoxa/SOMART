// The admin navigation now lives in the RBAC module map so the menu and the
// route guard can never disagree. Re-exported here to keep existing imports
// working.
export {
  ADMIN_LINKS as adminLinks,
  linksForRole,
  isActiveLink,
  type AdminLink,
} from "@/lib/roles";
