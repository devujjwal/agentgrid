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
  {
    id: 'guide',
    name: 'Public guide',
    title: 'Turn a definition into a useful resource.',
    description: 'Help people understand the problem, follow the workflow and judge the result.',
  },
  {
    id: 'sources',
    name: 'Sources & discovery',
    title: 'Make the useful facts easy to find.',
    description: 'Ground claims in sources you checked and connect this agent to relevant tasks.',
  },
  {
    id: 'guide-readiness',
    name: 'Guide readiness',
    title: 'Check what you are sending into the network.',
    description:
      'Your declarations help reviewers understand the work. They do not replace independent review.',
  },
] as const;
