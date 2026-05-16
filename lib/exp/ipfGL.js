// R1a — IPF GL Points strength-relative normalization.
//
// ipfGL(bw_kg, params) returns a scalar GL coefficient. Higher = stronger
// for that bodyweight per the official IPF GL formula:
//   ipfGL(bw_kg) = 100 / (a - b * exp(-c * bw_kg))
//
// bodyweightNormFactor(user_BW_lb, sex) returns the ratio
//   ipfGL(user_BW_kg) / ipfGL(REFERENCE_BW_kg)
// — i.e., 1.0 at REFERENCE_BW, >1 for lighter users, <1 for heavier.
//
// Sex defaults to male per R1a.

import { IPF_GL_PARAMS, REFERENCE_BW, LB_TO_KG } from '../exerciseAliases'

export { IPF_GL_PARAMS, REFERENCE_BW, LB_TO_KG }

export function ipfGL(bw_kg, params) {
  const { a, b, c } = params
  return 100 / (a - b * Math.exp(-c * bw_kg))
}

export function bodyweightNormFactor(user_BW_lb, sex = 'm') {
  const params = sex === 'f' ? IPF_GL_PARAMS.female : IPF_GL_PARAMS.male
  const user_kg = user_BW_lb * LB_TO_KG
  const ref_kg = REFERENCE_BW * LB_TO_KG
  return ipfGL(user_kg, params) / ipfGL(ref_kg, params)
}
