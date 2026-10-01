#!/usr/bin/env bash
#
# A canary for the linter, not a program (FB-246). **Do not "fix" the fault below.**
#
# `provision-lint` asserts that shellcheck FAILS on this file. If it ever passes, the setting that
# catches undefined uppercase variables has stopped applying — and every script in this repository
# would quietly lose the check without anything going red.
#
# That is not hypothetical. The fault it guards against reached a real deploy: `provision-office.sh`
# referenced `SCRIPT_DIR` and never defined it, which under `set -u` is fatal, so the step that
# copies the office onto a venture's box had never once run to completion (FB-245). shellcheck's
# SC2154 is on by default and did not catch it, because it exempts ALL-CAPS names on the assumption
# they come from the environment. `.shellcheckrc` lifts that exemption.
#
# A configuration file is a claim. This is the thing that checks the claim is still true.
set -euo pipefail

echo "${THIS_VARIABLE_IS_NEVER_ASSIGNED}"
