const fs = require("fs");

const shaderPath = "./public/shaders";
let shaders = fs.readdirSync(shaderPath);

let all = [];

for (let f of shaders) {
  all.push(`<script id="${f}" type="glsl">` + 
  fs.readFileSync(shaderPath + "/" + f).toString() + `</script>`);    
}

let index = fs.readFileSync("public/index.html").toString();

let package = index.replace("</body>", "</body>" + all.join("\n"));

//console.log(all.concat("\n"));
//console.log(index);

fs.writeFileSync("public/index-offline.html", package)