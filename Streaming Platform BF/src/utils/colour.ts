/** Turns a #rrggbb token into an rgba() string at the given alpha. */
export function withAlpha(hexColour: string, alpha: number) {
  const channels = hexColour.replace("#", "");
  const red = Number.parseInt(channels.slice(0, 2), 16);
  const green = Number.parseInt(channels.slice(2, 4), 16);
  const blue = Number.parseInt(channels.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
