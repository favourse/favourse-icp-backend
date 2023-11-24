#!/usr/bin/env bash

NAME=$1
LOGO=$2
SYMBOL=$3
MAXLIMIT=$4
STARTDATETIME=$5
ENDDATETIME=$6
LOCATION=$7
DESCRIPTION=$8
PRICE=$9
ISINPERSON=$10
ISFREE=$11
PRINCIPAL=$12
LOGOTYPE=$13
CANISTERNAME=$14
RECEIVERPRINCIPAL=$15


dfx stop
set -e
trap 'dfx stop' EXIT

echo "Adding $NAME canister to dfx.json..."
cat dfx.json | jq --arg name "$NAME" '.canisters += {($name): {"main": "src/token.mo"}}' > dfx.tmp
mv dfx.tmp dfx.json


dfx start --background --clean
dfx identity new alice --disable-encryption || true
# ALICE=$(dfx --identity alice identity get-principal)
dfx identity new bob --disable-encryption || true
# BOB=$(dfx --identity bob identity get-principal)

dfx deploy --argument "(
  principal\"$PRINCIPAL\", 
  record {
    logo = record {
      logo_type = \"$LOGOTYPE\";
      data = \"$LOGO\";
    };
    name = \"$NAME\"; 
    symbol = \"$SYMBOL\"; 
    maxLimit = $MAXLIMIT; 
    startDateTime = \"$STARTDATETIME\"; 
    endDateTime = \"$ENDDATETIME\"; 
    location = \"$LOCATION\"; 
    description = \"$DESCRIPTION\"; 
    price = $PRICE;
    isInPerson = $ISINPERSON; 
    isFree = $ISFREE;
  }
)" $CANISTERNAME

dfx canister call $CANISTERNAME mintDip721 \
"(
  principal\"$PRINCIPAL\", 
  vec { 
    record {
      purpose = variant{Rendered};
      data = blob\"$NAME\";
      key_val_data = vec {
        record { key = \"startDateTime\"; val = variant{TextContent=\"$STARTDATETIME\"}; };
        record { key = \"endDateTime\"; val = variant{TextContent=\"$ENDDATETIME\"}; };
        record { key = \"location\"; val = variant{TextContent=\"$LOCATION\"}; };
        record { key = \"name\"; val = variant{TextContent=\"$NAME\"}; };
      }
    }
  }
)"

dfx canister call dip721_nft_container transferFromDip721 "(principal\"$PRINCIPAl\", principal\"$RECEIVERPRINCIPAL\", 0)"
dfx canister call dip721_nft_container safeTransferFromDip721 "(principal\"$RECEIVERPRINCIPAL\", principal\"$PRINCIPAl\", 0)"
dfx canister call dip721_nft_container balanceOfDip721 "(principal\"$PRINCIPAl\")"

echo "DONE"
