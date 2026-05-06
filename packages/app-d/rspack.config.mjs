import { defineConfig } from '@rspack/cli'
import { rspack } from '@rspack/core'
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack'
import { VueLoaderPlugin } from 'vue-loader'

export default defineConfig({
  entry: './src/main.js',
  output: {
    publicPath: 'auto',
    uniqueName: 'appD',
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
  },
  experiments: {
    // Vue 2 + vue-style-loader 需要关闭 Rspack 内置 CSS 处理
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
    new ModuleFederationPlugin({
      name: 'appD',
      filename: 'remoteEntry.js',
      remotes: {
        appC: 'appC@http://localhost:9004/emp.js',
      },
      exposes: {
        './HelloWorld': './src/components/HelloWorld',
      },
      shared: {
        vue: {
          singleton: true,
          requiredVersion: '^2.7.14',
        },
        vuex: {
          singleton: true,
          requiredVersion: '3',
        },
      },
    }),
  ],
  devServer: {
    port: 9005,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
})
