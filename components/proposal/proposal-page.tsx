"use client";

import { useMemo } from "react";
import { Proposal } from "@/components/proposal/proposal";
import { buildSlides } from "@/components/proposal/slides";

export function ProposalPage({ client }: { client?: string }) {
  const slides = useMemo(() => buildSlides(client), [client]);
  return <Proposal slides={slides} />;
}
