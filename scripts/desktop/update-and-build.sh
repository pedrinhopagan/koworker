#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${ROOT_DIR}"

git fetch origin --prune

TARGET_REF=""
TARGET_BRANCH=""

if [ -n "${KOWORK_UPDATE_REF:-}" ]; then
	TARGET_REF="${KOWORK_UPDATE_REF}"
	TARGET_BRANCH="${KOWORK_UPDATE_BRANCH:-custom}"
	if ! git rev-parse --verify --quiet "${TARGET_REF}" >/dev/null; then
		echo "Referencia invalida em KOWORK_UPDATE_REF: ${TARGET_REF}"
		exit 1
	fi
elif git show-ref --verify --quiet refs/remotes/origin/master; then
	TARGET_REF="origin/master"
	TARGET_BRANCH="master"
elif git show-ref --verify --quiet refs/remotes/origin/main; then
	TARGET_REF="origin/main"
	TARGET_BRANCH="main"
else
	echo "Nenhuma branch remota origin/master ou origin/main foi encontrada."
	exit 1
fi

WORKTREE_DIR="$(mktemp -d -t kowork-desktop-build-XXXXXX)"

cleanup() {
	git -C "${ROOT_DIR}" worktree remove --force "${WORKTREE_DIR}" >/dev/null 2>&1 || true
	rm -rf "${WORKTREE_DIR}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

git worktree add --detach "${WORKTREE_DIR}" "${TARGET_REF}"

bun install --frozen-lockfile --cwd "${WORKTREE_DIR}"

if [ -f "${WORKTREE_DIR}/scripts/desktop/build-web.ts" ] && [ -f "${WORKTREE_DIR}/scripts/desktop/build-backend.ts" ]; then
	bun run --cwd "${WORKTREE_DIR}" desktop:build
else
	bun run --cwd "${WORKTREE_DIR}" tauri:build
fi

SHORT_SHA="$(git -C "${WORKTREE_DIR}" rev-parse --short HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${ROOT_DIR}/releases/linux/${TARGET_BRANCH}-${SHORT_SHA}-${STAMP}"
LATEST_LINK="${ROOT_DIR}/releases/linux/latest"
BUNDLE_DIR="${WORKTREE_DIR}/src-tauri/target/release/bundle"

if [ ! -d "${BUNDLE_DIR}" ]; then
	echo "Build concluido, mas pasta de bundle nao foi encontrada em ${BUNDLE_DIR}."
	exit 1
fi

mkdir -p "${RELEASE_DIR}"
cp -R "${BUNDLE_DIR}/." "${RELEASE_DIR}/"

rm -f "${LATEST_LINK}"
ln -s "${RELEASE_DIR}" "${LATEST_LINK}"

echo "Atualizacao concluida usando ${TARGET_REF}."
echo "Artefatos salvos em: ${RELEASE_DIR}"
echo "Atalho latest: ${LATEST_LINK}"
