const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const promisify = require("util").promisify;
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const spawn = require("child_process").spawn;
const uuidv4 = require("uuid/v4");
const mimeTypes = require("mime-types");
const request = require("request");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const nodemailer = require("nodemailer");

const app = express();
const port = process.env.PORT || 5000;
const defaultApiKey = () => {
  console.log("WARNING: Using default API key.");
  return "opensesame";
};
const apiKey = process.env.API_KEY || defaultApiKey();
const baseDir = "/tmp/ebook-convert/";

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir);
}

app.use(cors());
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(YAML.load("./swagger.yaml"))
);

const jsonParser = bodyParser.json();

// Require authentication for POST methods
app.use(function(req, res, next) {
  if (req.method === "GET" || req.header("x-api-key") === apiKey) {
    next();
  } else {
    res.status(403).send("Missing or incorrect X-Api-Key header.");
  }
});

// Setup email
var emailTransporter;
if (process.env.SMTP_HOST) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  emailTransporter = null;
  console.log(
    "WARNING: Please set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM, SMTP_USER and SMTP_PASS for email functionalities"
  );
}

function saveToFile(contentType, inputStream) {
  const extension = mimeTypes.extension(contentType) || "bin";
  const target = uuidv4() + "." + extension;
  const file = fs.createWriteStream(baseDir + target);
  inputStream.pipe(file);

  return target;
}

app.get("/version", async (req, res) => {
  const version = (await exec("ebook-convert --version")).stdout.split("\n")[0];
  res.json({
    calibre: version
  });
});

app.get("/get/:target", (req, res) => {
  // Prevent injection attack by only allowing images to be
  // served with the proper mime type. Other documents
  // (e.g. HTML) will be served as octet-stream to prevent
  // JavaScript from running providing a channel for
  // script injection attacks.
  // (Images are allowed so that they can be displayed by
  // browsers as a part of "preview" functionality.)
  const mimeType = mimeTypes.lookup(req.params.target) || '';
  var headers = {};
  if (!mimeType.startsWith("image/")) {
    headers["Content-Type"] = "application/octet-stream";
  }
  res.sendFile(req.params.target, { root: baseDir, headers });
});

app.post("/upload", (req, res) => {
  const target = saveToFile(req.header("content-type"), req);
  req.on("end", () => {
    res.json({
      href: target
    });
  });
});

app.post("/fetch", jsonParser, (req, res) => {
  const url = req.body.url;
  const headers = req.body.headers || {};
  const save = req.body.save || false;

  if (!url.indexOf("http") === 0) {
    throw Error("Only HTTP URLs are allowed");
  }

  const remoteReq = request.get(url, {
    headers
  });

  if (save) {
    // Save to file
    remoteReq
      .on("response", response => {
        const target = saveToFile(response.headers["content-type"], remoteReq);
        remoteReq.on("end", () => {
          res.json({
            href: target
          });
        });
      })
      .on("error", err => {
        throw Error(err);
      });
  } else {
    // Serve everything as application/octet-stream to prevent
    // script injection attack from HTML payload.
    remoteReq.pipefilter = function(response, dest) {
      for (const h in response.headers) {
        dest.removeHeader(h);
      }

      dest.setHeader("Content-Type", "application/octet-stream");
    };

    // Stream to browser
    remoteReq.pipe(res);
  }
});

app.post("/convert", jsonParser, (req, res) => {
  res.set("Content-Type", "text/plain");

  if (
    req.body.source.indexOf("/") !== -1 ||
    req.body.format.indexOf("/") !== -1
  ) {
    throw Error("Slash not allowed in path");
  }

  const target = uuidv4() + "." + req.body.format;

  const cmd = spawn("ebook-convert", [
    baseDir + req.body.source,
    baseDir + target,
    "--filter-css",
    "font-family,color,margin-left,margin-right"
  ]);

  var output = "";
  cmd.stdout.on("data", data => {
    output += data.toString();
  });
  cmd.stderr.on("data", data => {
    output += data.toString();
  });
  cmd.on("close", () => {
    res.json({
      href: target,
      output
    });
  });
});

app.post("/email", jsonParser, (req, res) => {
  if (emailTransporter === null) {
    throw Error("SMTP is not enabled");
  }

  if (!req.body.to) {
    throw Error("Recipient must be specified");
  }

  const toAddress = req.body.to;
  const subject = req.body.subject || "convert";
  const file = req.body.source;

  emailTransporter
    .sendMail({
      from: process.env.SMTP_FROM,
      to: toAddress,
      subject,
      attachments: [
        {
          path: baseDir + file
        }
      ]
    })
    .then(() => {
      res.sendStatus(204);
    })
    .catch(err => res.status(500).send(err));
});

app.listen(port, () => console.log(`Listening on port ${port}!`));
