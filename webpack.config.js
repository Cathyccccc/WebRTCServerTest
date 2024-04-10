const HtmlWebpackPlugin = require('html-webpack-plugin');
const { resolve } = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  mode: 'development',
  entry: './Public/js/index.js',
  output: {
    filename: 'main.js',
    path: resolve(__dirname, './Public/dist')
  },
  watch: true,
  module: {
    rules: [
      {
        test: /.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        },
        exclude: /node_modules/
      },
      {
        test: /.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: resolve(__dirname, './Public/index.html')
    }),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: isDev ? "[name].css" : "[name].[contenthash].css",
      chunkFilename: isDev ? "[id].css" : "[id].[contenthash].css",
    }),
  ]
}
