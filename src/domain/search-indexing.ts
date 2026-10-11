/** A publication is necessary, but cannot override the deployment's crawl gate. */
export function publicationRobots(
  published: boolean,
  stage: string | undefined = process.env.AGENTGRID_BUILD_STAGE,
) {
  const enabled = published && stage === 'production';
  return { index: enabled, follow: enabled };
}
