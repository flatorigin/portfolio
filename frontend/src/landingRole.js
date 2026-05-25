export function roleLandingPath(profileType) {
  if (profileType === "homeowner") return "/homeowner";
  if (profileType === "contractor") return "/contractor";
  return "/";
}

