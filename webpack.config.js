const path = require('path');

module.exports = {
    entry: './src/client/js/app.js',
    mode: 'development',
    output: {
        path: path.resolve(__dirname, 'bin/client/js'),
        filename: 'app.js'
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
};
