"use client";

import { Deck } from "./deck";
import { SLIDES } from "./slides";

export function Presentation() {
  return <Deck slides={SLIDES} />;
}
