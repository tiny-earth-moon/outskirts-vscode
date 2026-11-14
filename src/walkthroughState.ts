export const walkthroughId = "tiny-earth-moon.outskirts#gettingStarted";
export const walkthroughShownKey = "outskirts.walkthroughShown";
export const installCommand = "brew install tiny-earth-moon/tap/outskirts";

export function shouldOpenWalkthrough(alreadyShown: boolean, testing: boolean): boolean {
  return !alreadyShown && !testing;
}
