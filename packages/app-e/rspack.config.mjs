import { defineConfig } from '@rspack/cli'
import { rspack } from '@rspack/core'
import { VueLoaderPlugin } from 'vue-loader'

export default defineConfig({
  entry: './src/main.js',
  output: {
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
  },
  experiments: {
    css: false,
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader'],
        type: 'javascript/auto',
      },
      {
        test: /\.scss$/,
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: 'sass-embedded',
            },
          },
        ],
        type: 'javascript/auto',
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset',
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new rspack.HtmlRspackPlugin({
      template: './index.html',
    }),
  ],
  devServer: {
    port: 9006,
  },
})
