const path = require('path');

module.exports = {
    entry: './src/client/js/app.js',
    mode: 'development',
    output: {
        path: path.resolve(__dirname, 'bin/client/js'),
        filename: 'app.js'
    },
    externals: {
        '@solana/web3.js': 'solanaWeb3'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        fallback: {
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer/"),
            "util": require.resolve("util/"),
            "assert": require.resolve("assert/"),
            "http": require.resolve("stream-http"),
            "https": require.resolve("https-browserify"),
            "zlib": require.resolve("browserify-zlib"),
            "url": require.resolve("url/")
        }
    },
    plugins: [
        new (require('webpack')).ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser'
        })
    ]
};
