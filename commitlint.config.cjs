module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'style',
        'perf',
        'build',
        'ci',
        'revert',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
