# Branch protection (必須)

GitHub の main ブランチを保護し、Required status checks を必須にする。
`.github/workflows/ci.yml` の job 名 `verify` が green でない PR はマージ不可にする。

参考:
- About protected branches / Require status checks before merging
