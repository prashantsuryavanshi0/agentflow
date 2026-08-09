"use client";

import { NhostProvider } from "@nhost/nextjs";
import { NhostApolloProvider } from "@nhost/react-apollo";
import { Toaster } from "react-hot-toast";
import { nhost } from "@/lib/nhost";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#181C26",
              color: "#E9EBF2",
              border: "1px solid #242938",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
            },
          }}
        />
      </NhostApolloProvider>
    </NhostProvider>
  );
}
