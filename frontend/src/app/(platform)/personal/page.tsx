"use client";

import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Context routes — switch entity then land on dashboard */
export default function PersonalWealthPage() {
  const { setEntityType } = useEntity();
  const router = useRouter();

  useEffect(() => {
    setEntityType("PERSONAL");
    router.replace("/dashboard");
  }, [setEntityType, router]);

  return (
    <p className="text-sm text-cf-muted">Switching to Personal wealth…</p>
  );
}
