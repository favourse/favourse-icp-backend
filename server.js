const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/deploy", (req, res) => {
  // Extracting data from the request body
  let {
    principalId,
    logoType,
    logoData,
    name,
    maxLimit,
    startDateTime,
    endDateTime,
    location,
    price,
    isInPerson,
    isFree,
    description,
  } = req.body;
  const canisterName = name.replace(/\s+/g, "_").toLowerCase();
  // Split the name into an array of words
  // Ensure that the name is a string and has at least three characters
  if (typeof name !== "string" || name.length < 3) {
    return (name = name.replace(/\s+/g, "_"));
  }

  // Take the first three characters of the name string and convert them to uppercase
  const firstThreeChars = name.substring(0, 3).toUpperCase();

  // Update dfx.json with the new canister
  const dfxJsonPath = path.join(__dirname, "./dfx.json"); // Update this path as needed
  fs.readFile(dfxJsonPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading dfx.json");
    }

    let dfxConfig;
    try {
      dfxConfig = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).send("Error parsing dfx.json");
    }

    console.log("Received name:", canisterName);

    if (typeof canisterName !== "string" || name.trim() === "") {
      return res
        .status(400)
        .send("Canister name is not provided or is not a valid string.");
    }

    // Replace spaces with underscores and convert to lowercase
    dfxConfig.canisters[canisterName] = { main: "src/Main.mo" };

    console.log("Attempting to write to dfx.json with the following config:");
    console.log(JSON.stringify(dfxConfig, null, 2));

    fs.writeFile(
      dfxJsonPath,
      JSON.stringify(dfxConfig, null, 2),
      "utf8",
      (writeErr) => {
        if (writeErr) {
          console.error(`Error writing to dfx.json: ${writeErr}`);
          return res.status(500).send("Error writing to dfx.json");
        }

        console.log("dfx.json was updated successfully.");

        // Construct the deployment argument
        // const deployArgument = `"(principal\\\"${principalId}\\\", record { logo = record { logo_type = \\\"${logoType}\\\"; data = \\\"${logoData}\\\"; }; name = \\\"${name}\\\"; symbol = \\\"${firstThreeChars}\\\"; maxLimit = ${maxLimit}; })"`;
        const deployArgument = `"(principal\\\"${principalId}\\\", record {
            logo = record {
              logo_type = \\\"${logoType}\\\"; 
              data = \\\"${logoData}\\\"; 
            }; 
            name = \\\"${name}\\\"; 
            symbol = \\\"${firstThreeChars}\\\"; 
            maxLimit = ${maxLimit}; 
            startDateTime = \\\"${startDateTime}\\\"; 
            endDateTime = \\\"${endDateTime}\\\"; 
            location = \\\"${location}\\\"; 
            description = \\\"${description}\\\"; 
            price = ${price}; 
            isInPerson = ${isInPerson}; 
            isFree = ${isFree};
          })"`;

        // Now deploy the new canister
        const deployCommand = `dfx deploy --argument ${deployArgument} ${canisterName}`;
        const getCanisterIdCommand = `dfx canister id ${canisterName}`;

        exec(
          deployCommand,
          { maxBuffer: 1024 * 500 },
          (deployError, deployStdout, deployStderr) => {
            if (deployError) {
              console.error(`exec error: ${deployError}`);
              return res
                .status(500)
                .json({ error: `Deployment failed: ${deployStderr}` });
            }

            // Regex to match the URL line
            const urlRegex = /canisterId=([^\s]+)/;
            const urlMatch = deployStdout.match(urlRegex);
            let canisterUrl = "";
            if (urlMatch && urlMatch.length > 1) {
              canisterUrl = urlMatch[0]; // Capturing the full URL from the stdout
            }

            if (canisterUrl) {
              // If we successfully captured the URL, return it
              res.json({
                message: "Deployment successful.",
                deployOutput: deployStdout,
                canisterUrl: canisterUrl, // Returning the full URL
              });
            } else {
              // If we did not find the URL, we assume the canister ID needs to be retrieved separately
              exec(getCanisterIdCommand, (idError, idStdout, idStderr) => {
                if (idError) {
                  console.error(`exec error: ${idError}`);
                  return res.status(500).json({
                    error: `Failed to get canister ID: ${idStderr}`,
                  });
                }

                // Extract the canister ID from the getCanisterIdCommand output
                const canisterId = idStdout.trim(); // Assuming the output is just the canister ID

                res.json({
                  message: "Deployment Successful",
                  deployOutput: deployStdout,
                  canisterId: canisterId,
                  principalId: principalId,
                  logoType: logoType,
                  logoData: logoData,
                  symbol: firstThreeChars,
                  canisterName: canisterName, // This will now contain the canister ID
                });
              });
            }
          }
        );
      }
    );
  });
});

app.post("/mint-nft", (req, res) => {
  // Extract data from the request body
  const {
    principalId,
    canisterName,
    name,
    location,
    startDateTime,
    endDateData,
    logoData,
    principalReceiver,
  } = req.body;

  // Append " NFT Ticket" to the name and convert to hex blob for the data field
  // const eventDataHex = Buffer.from(eventData).toString("hex");

  // Construct the argument for the mint command using the serialized key_val_data
  const mintCommand = `dfx canister call ${canisterName} mintDip721 '(
  principal "'${principalId}'", 
  vec { 
    record {
      purpose = variant{Rendered};
      data = blob"${name} NFT Ticket";
      key_val_data = vec {
        record { key = "startDateTime"; val = variant{TextContent="${startDateTime}"}; };
        record { key = "endDateTime"; val = variant{TextContent="${endDateData}"}; };
        record { key = "LogoData"; val = variant{TextContent="${logoData}"}; };
        record { key = "location"; val = variant{TextContent="${location}"}; };
        record { key = "name"; val = variant{TextContent="${name}"}; };
      }
    }
  }
)'`;

  // Construct the full mint command
  // const mintCommand = `dfx canister call ${canisterName} mintDip721\\ ${mintArgument}`;

  // Execute the mint command
  exec(mintCommand, { maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error minting NFT: ${error}`);
      return res.status(500).send(`Error minting NFT: ${stderr}`);
    }
    // Extract token_id from stdout
    const match = stdout.match(/token_id = (\d+)/);
    if (match && match[1]) {
      const tokenId = match[1]; // This is your token ID

      // Check if principalId and principalReceiver are different
      if (principalId !== principalReceiver) {
        // Construct the transfer command
        const transferCommand = `dfx canister call ${canisterName} safeTransferFromDip721 '(
          principal "${principalId}",
          principal "${principalReceiver}",
          ${tokenId}
        )'`;

        // Execute the transfer command
        exec(
          transferCommand,
          { maxBuffer: 1024 * 500 },
          (transferError, transferStdout, transferStderr) => {
            if (transferError) {
              console.error(`Error transferring NFT: ${transferError}`);
              return res
                .status(500)
                .send(`Error transferring NFT: ${transferStderr}`);
            }
            console.log(
              `NFT transferred: ${transferStdout} tokenID ${tokenId}`
            );
            res
              .status(200)
              .send(
                `NFT minted and transferred successfully with token ID: ${tokenId}`
              );
          }
        );
      } else {
        // If the principals are the same, no need to transfer
        console.log(`NFT minted with token ID: ${tokenId}`);
        res
          .status(200)
          .send(`NFT minted successfully with token ID: ${tokenId}`);
      }
    } else {
      console.error("Token ID could not be extracted from the output.");
      res
        .status(500)
        .send("Error minting NFT: Token ID could not be extracted.");
    }
  });
});

const PORT = process.env.PORT || 3040;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
