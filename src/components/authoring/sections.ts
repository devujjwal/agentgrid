export const sections = [
  {
    id: 'intent',
    name: 'Purpose',
    title: 'Start with a useful outcome.',
    description: 'Give people a clear reason to choose this agent.',
  },
  {
    id: 'behavior',
    name: 'Behavior',
    title: 'Define how it thinks and acts.',
    description: 'Useful instructions are specific, bounded and repeatable.',
  },
  {
    id: 'exchange',
    name: 'Inputs & outputs',
    title: 'Make the exchange explicit.',
    description: 'Show what someone provides and what they receive.',
  },
  {
    id: 'platforms',
    name: 'Platforms',
    title: 'Connect it to the right workspace.',
    description: 'Intended compatibility needs practical setup and observed testing.',
  },
  {
    id: 'access',
    name: 'Tools & access',
    title: 'Name every connection.',
    description: 'Declare requirements and permissions rather than implying hidden access.',
  },
  {
    id: 'examples',
    name: 'Examples',
    title: 'Show the task in action.',
    description: 'Concrete examples help people understand the resource and its boundaries.',
  },
  {
    id: 'boundaries',
    name: 'Safety & limits',
    title: 'Make its boundaries visible.',
    description: 'Explain privacy, approval and situations where this agent should stop.',
  },
  {
    id: 'reuse',
    name: 'Reuse terms',
    title: 'Choose what travels with it.',
    description: 'Licensing and attribution belong to the package, including every fork.',
  },
] as const;
