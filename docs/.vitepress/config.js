export default {
    // Site metadata
    title: 'ParleyJS',
    description: 'Type-safe, robust framework for window, tab, and iframe communication',
    lang: 'en-US',

    // Base URL for documentation subdirectory (parleyjs.com/docs/)
    base: '/docs/',

    // Output directory (builds to docs-site/docs/)
    outDir: '../docs-site/docs',

    // Clean URLs (removes .html extension)
    cleanUrls: true,

    // Ignore dead links (will be fixed incrementally)
    ignoreDeadLinks: true,

    // Head tags
    head: [
        ['link', { rel: 'icon', type: 'image/png', href: '/parley-logo.png' }],
        ['meta', { name: 'theme-color', content: '#B8E100' }],
        ['meta', { name: 'og:type', content: 'website' }],
        ['meta', { name: 'og:locale', content: 'en' }],
        ['meta', { name: 'og:site_name', content: 'ParleyJS Documentation' }],
        ['meta', { name: 'og:description', content: 'Complete documentation for ParleyJS - Type-safe, robust framework for window, tab, and iframe communication' }],
        ['meta', { name: 'og:image', content: 'https://parleyjs.com/parley-logo.png' }],
    ],

    // Theme configuration
    themeConfig: {
        // Logo in navbar (use PNG from docs-site)
        logo: '/parley-logo.png',

        // Site title in navbar
        siteTitle: 'ParleyJS Docs',

        // Navigation menu
        nav: [
            { text: 'Home', link: 'https://parleyjs.com' },
            { text: 'Guide', link: '/getting-started/' },
            { text: 'API Reference', link: '/api-reference/' },
            { text: 'Examples', link: '/examples/' },
            {
                text: 'Resources',
                items: [
                    { text: 'Guides', link: '/guides/' },
                    { text: 'Patterns', link: '/patterns/' },
                    { text: 'Security', link: '/security/' },
                    { text: 'Troubleshooting', link: '/troubleshooting/' },
                ],
            },
        ],

        // Sidebar navigation
        sidebar: {
            '/getting-started/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Overview', link: '/getting-started/' },
                        { text: 'Installation', link: '/getting-started/installation' },
                        { text: 'Core Concepts', link: '/getting-started/concepts' },
                        { text: 'First Example', link: '/getting-started/first-example' },
                    ],
                },
            ],

            '/guides/': [
                {
                    text: 'Guides',
                    items: [
                        { text: 'Overview', link: '/guides/' },
                        { text: 'iFrame Communication', link: '/guides/iframe-communication' },
                        { text: 'Popup Communication', link: '/guides/popup-communication' },
                        { text: 'Multi-Window Communication', link: '/guides/multi-window-communication' },
                        { text: 'Worker Communication', link: '/guides/worker-communication' },
                        { text: 'Micro-Frontends', link: '/guides/micro-frontends' },
                    ],
                },
            ],

            '/patterns/': [
                {
                    text: 'Code Patterns',
                    items: [
                        { text: 'Overview', link: '/patterns/' },
                        { text: 'Request-Response', link: '/patterns/request-response' },
                        { text: 'Error Handling', link: '/patterns/error-handling' },
                        { text: 'State Synchronization', link: '/patterns/state-synchronization' },
                    ],
                },
            ],

            '/api-reference/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Overview', link: '/api-reference/' },
                        { text: 'Methods', link: '/api-reference/methods' },
                        { text: 'System Events', link: '/api-reference/system-events' },
                    ],
                },
                {
                    text: 'Complete API',
                    items: [
                        { text: 'API Documentation', link: '/API' },
                    ],
                },
            ],

            '/security/': [
                {
                    text: 'Security',
                    items: [
                        { text: 'Overview', link: '/security/' },
                        { text: 'Origin Validation', link: '/security/origin-validation' },
                        { text: 'Message Validation', link: '/security/message-validation' },
                    ],
                },
                {
                    text: 'Complete Guide',
                    items: [
                        { text: 'Security Guide', link: '/SECURITY' },
                    ],
                },
            ],

            '/troubleshooting/': [
                {
                    text: 'Troubleshooting',
                    items: [
                        { text: 'Overview', link: '/troubleshooting/' },
                        { text: 'Common Errors', link: '/troubleshooting/common-errors' },
                    ],
                },
                {
                    text: 'Complete Guide',
                    items: [
                        { text: 'Troubleshooting Guide', link: '/TROUBLESHOOTING' },
                    ],
                },
            ],

            '/examples/': [
                {
                    text: 'Examples',
                    items: [
                        { text: 'Overview', link: '/examples/' },
                        { text: 'Basic Example', link: '/examples/basic-example' },
                    ],
                },
                {
                    text: 'Complete Examples',
                    items: [
                        { text: 'All Examples', link: '/EXAMPLES' },
                    ],
                },
            ],

            '/': [
                {
                    text: 'Documentation',
                    items: [
                        { text: 'Getting Started', link: '/getting-started/' },
                        { text: 'Guides', link: '/guides/' },
                        { text: 'Patterns', link: '/patterns/' },
                        { text: 'API Reference', link: '/api-reference/' },
                        { text: 'Examples', link: '/examples/' },
                        { text: 'Security', link: '/security/' },
                        { text: 'Troubleshooting', link: '/troubleshooting/' },
                    ],
                },
                {
                    text: 'Additional Resources',
                    items: [
                        { text: 'Framework Reference', link: '/FRAMEWORK_REFERENCE' },
                        { text: 'Architecture', link: '/ARCHITECTURE' },
                        { text: 'Testing', link: '/TESTING' },
                        { text: 'Code Patterns', link: '/CODE_PATTERNS' },
                        { text: 'Performance', link: '/performance/' },
                    ],
                },
            ],
        },

        // Social links
        socialLinks: [
            { icon: 'github', link: 'https://github.com/WebDev-Guy/parley-js' },
        ],

        // Footer
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2024 Ignite Works, LLC',
        },

        // Edit link
        editLink: {
            pattern: 'https://github.com/WebDev-Guy/parley-js/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },

        // Last updated timestamp
        lastUpdated: {
            text: 'Last updated',
            formatOptions: {
                dateStyle: 'medium',
                timeStyle: 'short',
            },
        },

        // Search configuration (local search)
        search: {
            provider: 'local',
            options: {
                detailedView: true,
            },
        },

        // Outline configuration (table of contents)
        outline: {
            level: [2, 3],
            label: 'On this page',
        },

        // Doc footer navigation
        docFooter: {
            prev: 'Previous',
            next: 'Next',
        },
    },

    // Markdown configuration
    markdown: {
        theme: {
            light: 'github-light',
            dark: 'github-dark',
        },
        lineNumbers: true,
    },
};
