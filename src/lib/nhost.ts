import { NhostClient } from "@nhost/nextjs";

export const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "localhost",
  region: process.env.NEXT_PUBLIC_NHOST_REGION || "",
  // For local `nhost up` development, subdomain "localhost" + no
  // region talks to the local Nhost CLI stack automatically.
});
