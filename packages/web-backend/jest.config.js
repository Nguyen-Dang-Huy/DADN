export default {
    // 1. Removed moduleNameMapper to let Jest resolve exact file paths natively
    
    transform: {
        '^.+\\.js$': ['babel-jest', { 
            presets: [
                ['@babel/preset-env', { targets: { node: 'current' } }]
            ] 
        }],
    },
    
    transformIgnorePatterns: [
        'node_modules/(?!(supertest)/)',
    ],
    
    testEnvironment: 'node',
};