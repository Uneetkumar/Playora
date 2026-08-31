"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function GamesPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
