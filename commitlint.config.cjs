/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',     // new feature
                'fix',      // bug fix
                'docs',     // documentation only
                'style',    // formatting, whitespace
                'refactor', // code change that neither fixes a bug nor adds a feature
                'perf',     // performance improvement
                'test',     // adding or updating tests
                'build',    // build system or external dependencies
                'ci',       // CI/CD configuration
                'chore',    // other changes that don't modify src or test files
                'revert',   // revert a previous commit
                'wip',      // work in progress (avoid on main)
            ],
        ],
        'subject-case': [2, 'always', 'lower-case'],
        'header-max-length': [2, 'always', 100],
        'body-max-line-length': [2, 'always', 100],
    },
};
