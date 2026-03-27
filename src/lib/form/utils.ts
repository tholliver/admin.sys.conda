export function noWheel(node: HTMLInputElement) {
  const handler = (e: WheelEvent) => e.preventDefault();
  node.addEventListener("wheel", handler, { passive: false });

  return {
    destroy: () => node.removeEventListener("wheel", handler),
  };
}
