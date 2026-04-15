module.exports = {
  apps: [
    {
      name: "admin.sys.conda",
      script: "./dist/server/entry.mjs",
      interpreter: "bun",
      cwd: "./",
      env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 4321,
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      // ignore_watch: [
      //   'node_modules',
      //   'logs',
      //   '.git',
      //   '*.log',
      //   'dist', // Ignore if you only want to watch source files
      // ],
      // Only watch specific directories
      // watch_options: {
      //   followSymlinks: false,
      //   usePolling: true, // Useful for some file systems
      // },
      log_file: "./logs/app.log",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
