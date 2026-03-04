#!/bin/sh
pushd "$(dirname "$0")/.." > /dev/null
version=$(curl -sL https://api.github.com/repos/dsillman2000/yaml-reference-specs/releases/latest | jq -r .tag_name)
status="failing"
color="red"
YAML_REFERENCE_CLI_EXECUTABLE=$(pwd)/dist/cli/index.js go run github.com/dsillman2000/yaml-reference-specs@${version}
if [ $? -eq 0 ]; then
    status="passing"
    color="green"
fi
fmtversion=$(echo ${version} | sed 's/-/--/g')
echo "Spec test compliance status:"
echo "  version = ${version}"
echo "  status = ${status}"
echo "Done."

badge_url="https://img.shields.io/badge/spec%20${fmtversion}-${status}-${color}?link=https%3A%2F%2Fgithub.com%2Fdsillman2000%2Fyaml-reference-specs%2Ftree%2F${version}"
badge="![Spec Status](${badge_url})"
sed -i '' 's|!\[Spec Status\]([^)]*)|![Spec Status]('"$badge_url"')|g' README.md
echo "README.md badge updated"
popd > /dev/null