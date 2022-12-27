const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'none',
  entry: {
    verifier: './src/verifier.js',
    prover: './src/prover.js'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js'
  },
  /* experiments: {
    asyncWebAssembly: true,
  }, */
  plugins: [
    new TerserPlugin({
      parallel: true,
      terserOptions: {
        ecma: 6,
      },
    }),
    new CopyWebpackPlugin([
        { from: './public/', to: "./" }
    ])
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
  			loader: 'babel-loader',
        options: {
            'plugins': [
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-syntax-dynamic-import'
            ]
        }
		  }
    ]
  }
}