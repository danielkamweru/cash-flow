"use client";

import { useEntity, useEntityData } from "@/lib/context/EntityContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BusinessWealthPage() {
  const { setEntityType } = useEntity();
  const router = useRouter();

  useEffect(() => {
    setEntityType("BUSINESS");
    router.replace("/dashboard");
  }, [setEntityType, router]);

  return <p className="text-sm text-cf-muted">Switching to Business wealth…</p>;
}
