const express = require("express");
const cors = require("cors");
const app = express();
const exec = require("util").promisify(require("child_process").exec);
const port = process.env.PORT || 5000;

app.use(cors());

app.get("/version", async (req, res) => {
  const version = (await exec("ebook-convert --version")).stdout;
  res.json({
    calibre: version
  });
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
