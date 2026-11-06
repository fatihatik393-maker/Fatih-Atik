#!/usr/bin/env python3
"""
BURGER DISTRICT 2.2 — Rigged & Skinned 3D Customer Character GLB Compiler
Generates a spec-compliant binary glTF 2.0 (.glb) file at public/models/customer_character.glb
with:
- Complete 15-bone humanoid skeleton (`skins[0]`) with accurate inverseBindMatrices:
  Hips, Spine, Chest, Neck, Head, LeftArm, LeftForeArm, RightArm, RightForeArm,
  LeftUpLeg, LeftLeg, LeftFoot, RightUpLeg, RightLeg, RightFoot.
- Continuous seamless organic SkinnedMeshes with JOINTS_0 and WEIGHTS_0 attributes:
  SkinBodyMesh, ShirtTorsoMesh, JacketOuterMesh, TrousersMesh, SneakersMesh,
  AccessoriesMesh, GlassesMesh, Hair_quiff, Hair_ponytail, Hair_bob, Hair_cap.
- 7 Embedded skeletal keyframe animations (`animations[0..6]`):
  walk, idle_queue, ordering, idle_waiting_food, impatient_watch, receiving_happy, leaving_angry.
- Embedded 256x256 procedural PBR textures (Fabric Weave Albedo, ORM, and Normal Map).
"""

import json
import math
import os
import struct
import zlib
from typing import Callable, Dict, List, Optional, Tuple


def encode_png_rgba(width: int, height: int, pixels: bytes) -> bytes:
    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw_rows = bytearray()
    stride = width * 4
    for y in range(height):
        raw_rows.append(0)
        raw_rows.extend(pixels[y * stride : (y + 1) * stride])

    compressed = zlib.compress(bytes(raw_rows), level=6)
    return (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", compressed)
        + make_chunk(b"IEND", b"")
    )


def clamp_u8(val: float) -> int:
    return max(0, min(255, int(round(val))))


def build_fabric_pbr_textures(size: int = 256) -> Tuple[bytes, bytes, bytes]:
    """Returns (white_albedo_png, orm_png, normal_png) for tailored woven garment fabric."""
    albedo = bytearray(size * size * 4)
    orm = bytearray(size * size * 4)
    norm = bytearray(size * size * 4)
    hfield = [[0.0] * size for _ in range(size)]

    for y in range(size):
        for x in range(size):
            warp = math.sin(x * math.pi * 0.5) * 0.5 + 0.5
            weft = math.sin(y * math.pi * 0.5) * 0.5 + 0.5
            weave = (warp * 0.55 + weft * 0.45) if ((x + y) % 2 == 0) else (weft * 0.55 + warp * 0.45)
            fold = math.sin(x * 0.08 + y * 0.05) * 0.12
            h = weave * 0.18 + fold
            hfield[y][x] = h

            idx = (y * size + x) * 4
            v = clamp_u8(244 + (weave - 0.5) * 16)
            albedo[idx + 0] = v
            albedo[idx + 1] = v
            albedo[idx + 2] = v
            albedo[idx + 3] = 255

            ao = clamp_u8(232 + (weave - 0.5) * 32)
            rough = clamp_u8(166 + (1.0 - weave) * 30)
            orm[idx + 0] = ao
            orm[idx + 1] = rough
            orm[idx + 2] = 10
            orm[idx + 3] = 255

    strength = 1.35
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (hfield[y][xp] - hfield[y][xm]) * strength
            dy = (hfield[yp][x] - hfield[ym][x]) * strength
            inv = 1.0 / math.sqrt(dx * dx + dy * dy + 1.0)
            idx = (y * size + x) * 4
            norm[idx + 0] = clamp_u8((-dx * inv * 0.5 + 0.5) * 255)
            norm[idx + 1] = clamp_u8((-dy * inv * 0.5 + 0.5) * 255)
            norm[idx + 2] = clamp_u8((1.0 * inv * 0.5 + 0.5) * 255)
            norm[idx + 3] = 255

    return (
        encode_png_rgba(size, size, bytes(albedo)),
        encode_png_rgba(size, size, bytes(orm)),
        encode_png_rgba(size, size, bytes(norm)),
    )


# Joint indices in skin.joints (0..14):
J_HIPS = 0
J_SPINE = 1
J_CHEST = 2
J_NECK = 3
J_HEAD = 4
J_L_ARM = 5
J_L_FOREARM = 6
J_R_ARM = 7
J_R_FOREARM = 8
J_L_UPLEG = 9
J_L_LEG = 10
J_L_FOOT = 11
J_R_UPLEG = 12
J_R_LEG = 13
J_R_FOOT = 14

# Bind-pose world coordinates of the 15 joints
JOINT_BIND_WORLD: List[Tuple[str, Tuple[float, float, float], Optional[int]]] = [
    ("Hips", (0.0, 0.72, 0.0), None),
    ("Spine", (0.0, 0.88, 0.0), J_HIPS),
    ("Chest", (0.0, 1.10, 0.0), J_SPINE),
    ("Neck", (0.0, 1.34, 0.0), J_CHEST),
    ("Head", (0.0, 1.49, 0.0), J_NECK),
    ("LeftArm", (-0.215, 1.24, 0.0), J_CHEST),
    ("LeftForeArm", (-0.215, 1.02, 0.0), J_L_ARM),
    ("RightArm", (0.215, 1.24, 0.0), J_CHEST),
    ("RightForeArm", (0.215, 1.02, 0.0), J_R_ARM),
    ("LeftUpLeg", (-0.102, 0.72, 0.0), J_HIPS),
    ("LeftLeg", (-0.102, 0.38, 0.0), J_L_UPLEG),
    ("LeftFoot", (-0.102, 0.06, 0.0), J_L_LEG),
    ("RightUpLeg", (0.102, 0.72, 0.0), J_HIPS),
    ("RightLeg", (0.102, 0.38, 0.0), J_R_UPLEG),
    ("RightFoot", (0.102, 0.06, 0.0), J_R_LEG),
]


def normalize_weights(
    joints: Tuple[int, int, int, int], weights: Tuple[float, float, float, float]
) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    total = sum(weights)
    if total <= 1e-6:
        return (joints[0], 0, 0, 0), (1.0, 0.0, 0.0, 0.0)
    nw = [max(0.0, w / total) for w in weights]
    # Re-normalize so sum is strictly 1.0 in float32
    s = sum(nw)
    nw[0] += 1.0 - s
    return joints, (nw[0], nw[1], nw[2], nw[3])


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / max(1e-6, edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def weight_torso(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    """Smooth spine skinning from Hips (0.72) -> Spine (0.88) -> Chest (1.10) -> Neck (1.34)."""
    if y < 0.88:
        t = smoothstep(0.70, 0.88, y)
        return normalize_weights((J_HIPS, J_SPINE, 0, 0), (1.0 - t, t, 0.0, 0.0))
    if y < 1.24:
        t = smoothstep(0.88, 1.14, y)
        return normalize_weights((J_SPINE, J_CHEST, 0, 0), (1.0 - t, t, 0.0, 0.0))
    t = smoothstep(1.24, 1.38, y)
    return normalize_weights((J_CHEST, J_NECK, 0, 0), (1.0 - t, t, 0.0, 0.0))


def weight_neck_head(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    if y < 1.34:
        t = smoothstep(1.26, 1.34, y)
        return normalize_weights((J_CHEST, J_NECK, 0, 0), (1.0 - t, t, 0.0, 0.0))
    if y < 1.43:
        t = smoothstep(1.34, 1.43, y)
        return normalize_weights((J_NECK, J_HEAD, 0, 0), (1.0 - t, t, 0.0, 0.0))
    return ((J_HEAD, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))


def weight_left_arm(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    """Smooth shoulder-to-elbow-to-hand skinning on left arm (shoulder y=1.24, elbow y=1.02)."""
    if y > 1.21:
        t = smoothstep(1.21, 1.29, y)
        return normalize_weights((J_L_ARM, J_CHEST, 0, 0), (1.0 - t * 0.45, t * 0.45, 0.0, 0.0))
    if y > 0.96:
        t = smoothstep(0.96, 1.07, y)
        return normalize_weights((J_L_FOREARM, J_L_ARM, 0, 0), (1.0 - t, t, 0.0, 0.0))
    return ((J_L_FOREARM, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))


def weight_right_arm(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    """Smooth shoulder-to-elbow-to-hand skinning on right arm (shoulder y=1.24, elbow y=1.02)."""
    if y > 1.21:
        t = smoothstep(1.21, 1.29, y)
        return normalize_weights((J_R_ARM, J_CHEST, 0, 0), (1.0 - t * 0.45, t * 0.45, 0.0, 0.0))
    if y > 0.96:
        t = smoothstep(0.96, 1.07, y)
        return normalize_weights((J_R_FOREARM, J_R_ARM, 0, 0), (1.0 - t, t, 0.0, 0.0))
    return ((J_R_FOREARM, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))


def weight_left_leg(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    """Smooth hip (0.72) -> knee (0.38) -> ankle (0.06) skinning for left leg."""
    if y > 0.66:
        t = smoothstep(0.66, 0.75, y)
        return normalize_weights((J_L_UPLEG, J_HIPS, 0, 0), (1.0 - t * 0.65, t * 0.65, 0.0, 0.0))
    if y > 0.32:
        t = smoothstep(0.32, 0.44, y)
        return normalize_weights((J_L_LEG, J_L_UPLEG, 0, 0), (1.0 - t, t, 0.0, 0.0))
    if y > 0.05:
        t = smoothstep(0.05, 0.11, y)
        return normalize_weights((J_L_FOOT, J_L_LEG, 0, 0), (1.0 - t, t, 0.0, 0.0))
    return ((J_L_FOOT, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))


def weight_right_leg(x: float, y: float, z: float) -> Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]:
    """Smooth hip (0.72) -> knee (0.38) -> ankle (0.06) skinning for right leg."""
    if y > 0.66:
        t = smoothstep(0.66, 0.75, y)
        return normalize_weights((J_R_UPLEG, J_HIPS, 0, 0), (1.0 - t * 0.65, t * 0.65, 0.0, 0.0))
    if y > 0.32:
        t = smoothstep(0.32, 0.44, y)
        return normalize_weights((J_R_LEG, J_R_UPLEG, 0, 0), (1.0 - t, t, 0.0, 0.0))
    if y > 0.05:
        t = smoothstep(0.05, 0.11, y)
        return normalize_weights((J_R_FOOT, J_R_LEG, 0, 0), (1.0 - t, t, 0.0, 0.0))
    return ((J_R_FOOT, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))


def weight_rigid(joint_idx: int) -> Callable[[float, float, float], Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]]:
    def _fn(x: float, y: float, z: float):
        return ((joint_idx, 0, 0, 0), (1.0, 0.0, 0.0, 0.0))
    return _fn


class SkinnedMeshBuilder:
    def __init__(self) -> None:
        self.positions: List[Tuple[float, float, float]] = []
        self.normals: List[Tuple[float, float, float]] = []
        self.uvs: List[Tuple[float, float]] = []
        self.joints: List[Tuple[int, int, int, int]] = []
        self.weights: List[Tuple[float, float, float, float]] = []
        self.indices: List[int] = []

    def add_vertex(
        self,
        pos: Tuple[float, float, float],
        norm: Tuple[float, float, float],
        uv: Tuple[float, float],
        j: Tuple[int, int, int, int] = (0, 0, 0, 0),
        w: Tuple[float, float, float, float] = (1.0, 0.0, 0.0, 0.0),
    ) -> int:
        idx = len(self.positions)
        nx, ny, nz = norm
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length > 1e-6:
            nx, ny, nz = nx / length, ny / length, nz / length
        else:
            nx, ny, nz = 0.0, 1.0, 0.0
        j_norm, w_norm = normalize_weights(j, w)
        self.positions.append(pos)
        self.normals.append((nx, ny, nz))
        self.uvs.append(uv)
        self.joints.append(j_norm)
        self.weights.append(w_norm)
        return idx

    def add_tri(self, a: int, b: int, c: int) -> None:
        self.indices.extend([a, b, c])

    def add_quad(self, a: int, b: int, c: int, d: int) -> None:
        self.indices.extend([a, b, c, a, c, d])

    def add_lofted_tube(
        self,
        rings: List[Tuple[float, float, float, float, float]],
        radial_segments: int = 24,
        cap_bottom: bool = True,
        cap_top: bool = True,
        shape_fn=None,
        weight_fn=None,
    ) -> None:
        """
        rings: list of (world_y, rx, rz, cx_offset, cz_offset) from bottom to top.
        """
        if weight_fn is None:
            weight_fn = weight_rigid(J_HIPS)

        ring_count = len(rings)
        grid: List[List[int]] = []

        for r_idx, (ry, rx, rz, ox, oz) in enumerate(rings):
            v_coord = r_idx / max(1, ring_count - 1)
            row: List[int] = []
            for s in range(radial_segments + 1):
                u_coord = s / float(radial_segments)
                theta = u_coord * math.pi * 2.0
                ct = math.cos(theta)
                st = math.sin(theta)
                px = ox + ct * rx
                py = ry
                pz = oz + st * rz
                if shape_fn is not None:
                    px, py, pz = shape_fn(v_coord, theta, px, py, pz)
                nx = ct / max(0.01, rx)
                nz = st / max(0.01, rz)
                ny = 0.0
                j, w = weight_fn(px, py, pz)
                row.append(
                    self.add_vertex(
                        (px, py, pz),
                        (nx, ny, nz),
                        (u_coord * 2.0, v_coord * 2.0),
                        j,
                        w,
                    )
                )
            grid.append(row)

        for r_idx in range(ring_count - 1):
            for s in range(radial_segments):
                a = grid[r_idx][s]
                b = grid[r_idx][s + 1]
                c = grid[r_idx + 1][s + 1]
                d = grid[r_idx + 1][s]
                self.add_quad(a, d, c, b)

        if cap_bottom and len(rings) > 0:
            by, _, _, box, boz = rings[0]
            j, w = weight_fn(box, by, boz)
            c_idx = self.add_vertex((box, by, boz), (0.0, -1.0, 0.0), (0.5, 0.5), j, w)
            for s in range(radial_segments):
                self.add_tri(c_idx, grid[0][s + 1], grid[0][s])

        if cap_top and len(rings) > 0:
            ty, _, _, tox, toz = rings[-1]
            j, w = weight_fn(tox, ty, toz)
            c_idx = self.add_vertex((tox, ty, toz), (0.0, 1.0, 0.0), (0.5, 0.5), j, w)
            for s in range(radial_segments):
                self.add_tri(c_idx, grid[-1][s], grid[-1][s + 1])

        self.recompute_smooth_normals()

    def add_ellipsoid(
        self,
        cx: float,
        cy: float,
        cz: float,
        rx: float,
        ry: float,
        rz: float,
        lat_segs: int = 12,
        lon_segs: int = 16,
        theta_max: float = math.pi,
        rot_x: float = 0.0,
        rot_y: float = 0.0,
        rot_z: float = 0.0,
        weight_fn=None,
    ) -> None:
        if weight_fn is None:
            weight_fn = weight_rigid(J_HEAD)

        cx_r, sx_r = math.cos(rot_x), math.sin(rot_x)
        cy_r, sy_r = math.cos(rot_y), math.sin(rot_y)
        cz_r, sz_r = math.cos(rot_z), math.sin(rot_z)

        def rotate_pt(x: float, y: float, z: float) -> Tuple[float, float, float]:
            # Z -> X -> Y Euler rotation
            x1, y1, z1 = x * cz_r - y * sz_r, x * sz_r + y * cz_r, z
            x2, y2, z2 = x1, y1 * cx_r - z1 * sx_r, y1 * sx_r + z1 * cx_r
            x3, y3, z3 = x2 * cy_r + z2 * sy_r, y2, -x2 * sy_r + z2 * cy_r
            return x3, y3, z3

        grid: List[List[int]] = []
        for i in range(lat_segs + 1):
            v = i / float(lat_segs)
            phi = v * theta_max
            sp, cp = math.sin(phi), math.cos(phi)
            row: List[int] = []
            for s in range(lon_segs + 1):
                u = s / float(lon_segs)
                theta = u * math.pi * 2.0
                ct, st = math.cos(theta), math.sin(theta)
                lx = rx * sp * ct
                ly = ry * cp
                lz = rz * sp * st
                rx_p, ry_p, rz_p = rotate_pt(lx, ly, lz)
                px, py, pz = cx + rx_p, cy + ry_p, cz + rz_p
                nx, ny, nz = rotate_pt(sp * ct / max(0.005, rx), cp / max(0.005, ry), sp * st / max(0.005, rz))
                j, w = weight_fn(px, py, pz)
                row.append(self.add_vertex((px, py, pz), (nx, ny, nz), (u, v), j, w))
            grid.append(row)

        for i in range(lat_segs):
            for s in range(lon_segs):
                a = grid[i][s]
                b = grid[i][s + 1]
                c = grid[i + 1][s + 1]
                d = grid[i + 1][s]
                self.add_quad(a, b, c, d)

        self.recompute_smooth_normals()

    def recompute_smooth_normals(self) -> None:
        accum = [[0.0, 0.0, 0.0] for _ in range(len(self.positions))]
        for i in range(0, len(self.indices), 3):
            ia, ib, ic = self.indices[i], self.indices[i + 1], self.indices[i + 2]
            ax, ay, az = self.positions[ia]
            bx, by, bz = self.positions[ib]
            cx, cy, cz = self.positions[ic]
            ux, uy, uz = bx - ax, by - ay, bz - az
            vx, vy, vz = cx - ax, cy - ay, cz - az
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            for idx in (ia, ib, ic):
                accum[idx][0] += nx
                accum[idx][1] += ny
                accum[idx][2] += nz

        for i, (nx, ny, nz) in enumerate(accum):
            l = math.sqrt(nx * nx + ny * ny + nz * nz)
            if l > 1e-6:
                self.normals[i] = (nx / l, ny / l, nz / l)


def build_skin_body_mesh() -> SkinnedMeshBuilder:
    """
    Continuous anatomical skin mesh:
    - Sculpted Head (chin, jawline, cheekbones, nose bridge, brow) + Ears + Continuous Neck
    - Continuous Left & Right Forearms + Wrists + Sculpted Palms + Thumbs
    """
    mb = SkinnedMeshBuilder()

    # 1. Continuous Neck (y=1.27..1.38) blending into Sculpted Head (y=1.34..1.67)
    head_neck_rings = [
        (1.275, 0.076, 0.074, 0.0, 0.0),
        (1.315, 0.066, 0.065, 0.0, 0.002),
        (1.345, 0.064, 0.068, 0.0, 0.008),
        (1.370, 0.098, 0.118, 0.0, 0.012),
        (1.418, 0.128, 0.146, 0.0, 0.008),
        (1.472, 0.146, 0.158, 0.0, 0.004),
        (1.528, 0.152, 0.164, 0.0, 0.002),
        (1.588, 0.145, 0.158, 0.0, -0.004),
        (1.638, 0.116, 0.130, 0.0, -0.008),
        (1.668, 0.056, 0.062, 0.0, -0.010),
    ]

    def head_sculpt(v: float, theta: float, x: float, y: float, z: float):
        front_align = math.sin(theta)
        horiz = math.cos(theta)
        # Defined nose bridge, tip & subtle alar wings around +Z
        if front_align > 0.70 and 0.40 <= v <= 0.73:
            nose_w = math.exp(-((horiz / 0.16) ** 2))
            nose_h = math.sin((v - 0.40) / 0.33 * math.pi)
            tip_boost = 0.008 * math.exp(-(((v - 0.48) / 0.08) ** 2)) * nose_w
            z += 0.032 * nose_w * nose_h + tip_boost
        # Eye socket subtle orbital recess so eyes sit naturally inside the face
        if front_align > 0.55 and 0.54 <= v <= 0.68:
            eye_dist = abs(horiz) - 0.36
            socket = math.exp(-((eye_dist / 0.16) ** 2)) * math.sin((v - 0.54) / 0.14 * math.pi)
            z -= 0.006 * socket
        # Cheekbone & jaw contour
        if front_align > 0.20 and 0.42 <= v <= 0.66:
            cheek = math.exp(-(((abs(horiz) - 0.56) / 0.22) ** 2))
            x += (0.010 if x > 0 else -0.010) * cheek
            z += 0.009 * cheek
        # Brow ridge
        if front_align > 0.62 and 0.67 <= v <= 0.81:
            brow = math.sin((v - 0.67) / 0.14 * math.pi)
            z += 0.012 * brow
        # Chin & lower lip fullness
        if front_align > 0.72 and 0.18 <= v <= 0.36:
            chin_w = math.exp(-((horiz / 0.25) ** 2))
            chin_h = math.sin((v - 0.18) / 0.18 * math.pi)
            z += 0.011 * chin_w * chin_h
        return x, y, z

    mb.add_lofted_tube(
        head_neck_rings,
        radial_segments=32,
        cap_bottom=True,
        cap_top=True,
        shape_fn=head_sculpt,
        weight_fn=weight_neck_head,
    )

    # 2. Left & Right Sculpted Ears with Helix Rim weighted to Head
    for side in (-1.0, 1.0):
        mb.add_ellipsoid(
            side * 0.152,
            1.495,
            -0.006,
            0.020,
            0.042,
            0.029,
            lat_segs=10,
            lon_segs=12,
            rot_y=side * -0.18,
            weight_fn=weight_rigid(J_HEAD),
        )

    # 2b. Sculpted 3D Anatomical Nose Bridge, Tip & Nostril Wings weighted to Head
    mb.add_ellipsoid(
        0.0, 1.504, 0.176, 0.013, 0.026, 0.018, lat_segs=10, lon_segs=12, rot_x=-0.22, weight_fn=weight_rigid(J_HEAD)
    )
    mb.add_ellipsoid(
        0.0, 1.482, 0.186, 0.015, 0.014, 0.016, lat_segs=10, lon_segs=12, weight_fn=weight_rigid(J_HEAD)
    )
    for side in (-1.0, 1.0):
        mb.add_ellipsoid(
            side * 0.014, 1.478, 0.177, 0.010, 0.009, 0.011, lat_segs=8, lon_segs=10, weight_fn=weight_rigid(J_HEAD)
        )

    # 3. Continuous Forearm + Wrist + Sculpted Palm + 4 Individual Fingers & Opposable Thumb
    for side, w_fn in ((-1.0, weight_left_arm), (1.0, weight_right_arm)):
        ax = side * 0.215
        arm_rings = [
            (0.758, 0.036, 0.018, ax, 0.008),   # Metacarpal knuckles
            (0.792, 0.041, 0.023, ax, 0.006),   # Palm center
            (0.830, 0.033, 0.028, ax, 0.0),     # Wrist
            (0.895, 0.039, 0.038, ax, 0.0),     # Lower forearm
            (0.965, 0.046, 0.045, ax, 0.0),     # Upper forearm
            (1.035, 0.045, 0.045, ax, 0.0),     # Elbow joint blend
        ]
        mb.add_lofted_tube(
            arm_rings,
            radial_segments=18,
            cap_bottom=True,
            cap_top=True,
            weight_fn=w_fn,
        )
        # 4 Individual Sculpted Finger Digits extending from palm
        finger_offsets = [(-0.024, 0.036), (-0.008, 0.040), (0.008, 0.038), (0.023, 0.031)]
        for f_dx, f_len in finger_offsets:
            mb.add_ellipsoid(
                ax + f_dx,
                0.758 - f_len * 0.65,
                0.012,
                0.0075,
                f_len * 0.65,
                0.008,
                lat_segs=6,
                lon_segs=8,
                rot_x=-0.12,
                weight_fn=w_fn,
            )
        # Opposable Thumb protrusion on inner side of hand
        mb.add_ellipsoid(
            ax - side * 0.036,
            0.782,
            0.028,
            0.012,
            0.028,
            0.013,
            lat_segs=6,
            lon_segs=8,
            rot_z=side * 0.42,
            rot_x=-0.22,
            weight_fn=w_fn,
        )

    return mb


def build_shirt_torso_mesh() -> SkinnedMeshBuilder:
    """
    Continuous anatomical inner shirt from hips (y=0.76) through waist (y=0.92),
    chest (y=1.14), and shoulders/collar (y=1.31) + short sleeves.
    """
    mb = SkinnedMeshBuilder()
    rings = [
        (0.76, 0.168, 0.122, 0.0, 0.0),
        (0.84, 0.160, 0.116, 0.0, 0.0),
        (0.93, 0.156, 0.114, 0.0, 0.002),
        (1.03, 0.174, 0.128, 0.0, 0.008),
        (1.13, 0.192, 0.138, 0.0, 0.012),
        (1.22, 0.204, 0.134, 0.0, 0.006),
        (1.28, 0.180, 0.116, 0.0, 0.0),
        (1.315, 0.106, 0.088, 0.0, 0.0),
    ]

    def torso_sculpt(v: float, theta: float, x: float, y: float, z: float):
        if z > 0 and 0.42 <= v <= 0.86:
            chest = math.sin((v - 0.42) / 0.44 * math.pi) * 0.015 * (math.sin(theta) ** 2)
            z += chest
        return x, y, z

    mb.add_lofted_tube(
        rings,
        radial_segments=28,
        cap_bottom=True,
        cap_top=True,
        shape_fn=torso_sculpt,
        weight_fn=weight_torso,
    )

    # Continuous upper-arm sleeves (inset 8mm inside outer jacket sleeves so they never z-fight)
    for side, w_fn in ((-1.0, weight_left_arm), (1.0, weight_right_arm)):
        ax = side * 0.215
        sleeve_rings = [
            (1.01, 0.043, 0.043, ax, 0.0),
            (1.09, 0.047, 0.047, ax, 0.0),
            (1.17, 0.050, 0.050, ax, 0.0),
            (1.24, 0.052, 0.052, ax, 0.0),
            (1.285, 0.042, 0.042, ax - side * 0.025, 0.0),
        ]
        mb.add_lofted_tube(
            sleeve_rings,
            radial_segments=18,
            cap_bottom=True,
            cap_top=True,
            weight_fn=w_fn,
        )

    return mb


def build_jacket_outer_mesh() -> SkinnedMeshBuilder:
    """
    Tailored open-front jacket with lapels, collar, and continuous sleeves
    weighted across Spine, Chest, LeftArm/LeftForeArm, and RightArm/RightForeArm.
    """
    mb = SkinnedMeshBuilder()
    rings = [
        (0.79, 0.180, 0.132, 0.0, -0.002),
        (0.91, 0.169, 0.125, 0.0, -0.002),
        (1.04, 0.186, 0.138, 0.0, 0.004),
        (1.16, 0.204, 0.146, 0.0, 0.008),
        (1.25, 0.214, 0.140, 0.0, 0.003),
        (1.30, 0.150, 0.112, 0.0, -0.004),
        (1.345, 0.104, 0.096, 0.0, -0.008),
    ]
    arc_steps = 24
    ring_count = len(rings)
    outer_grid: List[List[int]] = []
    inner_grid: List[List[int]] = []

    t_start = 0.76 * math.pi
    t_end = 2.24 * math.pi

    for r_idx, (ry, rx, rz, ox, oz) in enumerate(rings):
        v = r_idx / max(1, ring_count - 1)
        o_row: List[int] = []
        i_row: List[int] = []
        for s in range(arc_steps + 1):
            u = s / float(arc_steps)
            theta = t_start + u * (t_end - t_start)
            ct = math.cos(theta)
            st = math.sin(theta)
            lapel = 0.0
            if (u < 0.12 or u > 0.88) and 0.45 < v < 0.92:
                lapel = 0.016 * math.sin((v - 0.45) / 0.47 * math.pi)
            px = ox + ct * (rx + lapel)
            pz = oz + st * (rz + lapel)
            j, w = weight_torso(px, ry, pz)
            o_row.append(mb.add_vertex((px, ry, pz), (ct, 0.0, st), (u * 2.0, v * 2.0), j, w))
            ix = ox + ct * (rx - 0.011)
            iz = oz + st * (rz - 0.011)
            i_row.append(mb.add_vertex((ix, ry, iz), (-ct, 0.0, -st), (u * 2.0, v * 2.0), j, w))
        outer_grid.append(o_row)
        inner_grid.append(i_row)

    for r_idx in range(ring_count - 1):
        for s in range(arc_steps):
            mb.add_quad(
                outer_grid[r_idx][s],
                outer_grid[r_idx + 1][s],
                outer_grid[r_idx + 1][s + 1],
                outer_grid[r_idx][s + 1],
            )
            mb.add_quad(
                inner_grid[r_idx][s],
                inner_grid[r_idx][s + 1],
                inner_grid[r_idx + 1][s + 1],
                inner_grid[r_idx + 1][s],
            )
        mb.add_quad(
            inner_grid[r_idx][0],
            inner_grid[r_idx + 1][0],
            outer_grid[r_idx + 1][0],
            outer_grid[r_idx][0],
        )
        mb.add_quad(
            outer_grid[r_idx][-1],
            outer_grid[r_idx + 1][-1],
            inner_grid[r_idx + 1][-1],
            inner_grid[r_idx][-1],
        )

    # Continuous tailored jacket sleeves extending past the elbow (y=0.92..1.29)
    for side, w_fn in ((-1.0, weight_left_arm), (1.0, weight_right_arm)):
        ax = side * 0.215
        j_sleeve_rings = [
            (0.93, 0.049, 0.049, ax, 0.0),
            (1.01, 0.053, 0.053, ax, 0.0),
            (1.10, 0.058, 0.058, ax, 0.0),
            (1.19, 0.063, 0.063, ax, 0.0),
            (1.25, 0.065, 0.064, ax - side * 0.01, 0.0),
            (1.29, 0.050, 0.050, ax - side * 0.03, 0.0),
        ]
        mb.add_lofted_tube(
            j_sleeve_rings,
            radial_segments=18,
            cap_bottom=True,
            cap_top=True,
            weight_fn=w_fn,
        )

    mb.recompute_smooth_normals()
    return mb


def build_trousers_mesh() -> SkinnedMeshBuilder:
    """
    Continuous tailored trousers:
    - Pelvis / hips waistband (y=0.66..0.81)
    - Seamless Left & Right trouser legs from hip (0.73) through knee (0.38) to ankle cuff (0.075),
      smoothly weighted across Hips, UpLeg, and Leg so knees bend organically without gaps.
    """
    mb = SkinnedMeshBuilder()
    pelvis_rings = [
        (0.66, 0.162, 0.118, 0.0, 0.0),
        (0.72, 0.175, 0.126, 0.0, 0.0),
        (0.78, 0.174, 0.126, 0.0, 0.0),
        (0.81, 0.168, 0.121, 0.0, 0.0),
    ]
    mb.add_lofted_tube(
        pelvis_rings,
        radial_segments=24,
        cap_bottom=True,
        cap_top=True,
        weight_fn=weight_torso,
    )

    for side, w_fn in ((-1.0, weight_left_leg), (1.0, weight_right_leg)):
        lx = side * 0.102
        leg_rings = [
            (0.075, 0.050, 0.052, lx, 0.0),      # Ankle cuff
            (0.160, 0.054, 0.057, lx, -0.004),   # Lower calf
            (0.270, 0.063, 0.066, lx, -0.007),   # Calf muscle
            (0.380, 0.060, 0.062, lx, 0.0),      # Knee joint
            (0.490, 0.068, 0.070, lx, 0.003),    # Lower thigh
            (0.610, 0.076, 0.078, lx, 0.004),    # Upper thigh
            (0.710, 0.080, 0.082, lx, 0.0),      # Hip socket blend
            (0.745, 0.068, 0.070, lx * 0.88, 0.0),
        ]
        mb.add_lofted_tube(
            leg_rings,
            radial_segments=20,
            cap_bottom=True,
            cap_top=True,
            weight_fn=w_fn,
        )

    return mb


def build_sneaker_uppers_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    for side, j_foot in ((-1.0, J_L_FOOT), (1.0, J_R_FOOT)):
        lx = side * 0.102
        rings = [
            (0.024, 0.058, 0.112, lx, 0.036),
            (0.050, 0.056, 0.106, lx, 0.034),
            (0.074, 0.050, 0.076, lx, 0.014),
            (0.094, 0.045, 0.054, lx, 0.002),
        ]
        mb.add_lofted_tube(
            rings,
            radial_segments=20,
            cap_bottom=True,
            cap_top=True,
            weight_fn=weight_rigid(j_foot),
        )
    return mb


def build_sneaker_soles_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    for side, j_foot in ((-1.0, J_L_FOOT), (1.0, J_R_FOOT)):
        lx = side * 0.102
        rings = [
            (0.000, 0.062, 0.118, lx, 0.036),
            (0.025, 0.060, 0.115, lx, 0.036),
        ]
        mb.add_lofted_tube(
            rings,
            radial_segments=20,
            cap_bottom=True,
            cap_top=True,
            weight_fn=weight_rigid(j_foot),
        )
    return mb


def build_belt_and_watch_mesh() -> Tuple[SkinnedMeshBuilder, SkinnedMeshBuilder]:
    """Returns (dark_leather_strap_mesh, brass_buckle_and_dial_mesh)."""
    strap_mb = SkinnedMeshBuilder()
    brass_mb = SkinnedMeshBuilder()

    # Waist belt around y=0.81..0.845
    belt_rings = [
        (0.808, 0.173, 0.126, 0.0, 0.0),
        (0.844, 0.173, 0.126, 0.0, 0.0),
    ]
    strap_mb.add_lofted_tube(belt_rings, radial_segments=24, cap_bottom=True, cap_top=True, weight_fn=weight_torso)

    # Watch strap on left wrist (x=-0.215, y=0.845)
    watch_rings = [
        (0.835, 0.036, 0.031, -0.215, 0.0),
        (0.855, 0.036, 0.031, -0.215, 0.0),
    ]
    strap_mb.add_lofted_tube(
        watch_rings,
        radial_segments=16,
        cap_bottom=True,
        cap_top=True,
        weight_fn=weight_rigid(J_L_FOREARM),
    )

    # Brass belt buckle at front waist (+Z)
    brass_mb.add_ellipsoid(
        0.0, 0.826, 0.128, 0.028, 0.022, 0.010, lat_segs=8, lon_segs=10, weight_fn=weight_torso
    )
    # Brass watch bezel on outer left wrist
    brass_mb.add_ellipsoid(
        -0.250, 0.845, 0.006, 0.008, 0.016, 0.016, lat_segs=8, lon_segs=10, weight_fn=weight_rigid(J_L_FOREARM)
    )

    return strap_mb, brass_mb


def build_face_features_meshes() -> Tuple[SkinnedMeshBuilder, SkinnedMeshBuilder, SkinnedMeshBuilder]:
    """Returns (sclera_white_mb, pupil_dark_mb, mouth_lips_mb) weighted to Head."""
    sclera_mb = SkinnedMeshBuilder()
    pupil_mb = SkinnedMeshBuilder()
    mouth_mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)

    for side in (-1.0, 1.0):
        # White sclera almond eye contour
        sclera_mb.add_ellipsoid(
            side * 0.052, 1.518, 0.155, 0.022, 0.018, 0.013, lat_segs=10, lon_segs=14, weight_fn=w_head
        )
        # Bright corneal catchlight highlight dot on upper-outer pupil so eyes look alive
        sclera_mb.add_ellipsoid(
            side * 0.056, 1.523, 0.170, 0.0042, 0.0042, 0.003, lat_segs=6, lon_segs=8, weight_fn=w_head
        )
        # Dark iris/pupil center
        pupil_mb.add_ellipsoid(
            side * 0.052, 1.518, 0.164, 0.0125, 0.0135, 0.008, lat_segs=8, lon_segs=12, weight_fn=w_head
        )
        # Upper eyelid lash line & lower lid crease
        pupil_mb.add_ellipsoid(
            side * 0.052, 1.531, 0.162, 0.024, 0.0045, 0.009, lat_segs=6, lon_segs=10, rot_z=side * -0.05, weight_fn=w_head
        )
        # Sculpted tapered eyebrow arch
        pupil_mb.add_ellipsoid(
            side * 0.054, 1.556, 0.161, 0.028, 0.0065, 0.010, lat_segs=6, lon_segs=10, rot_z=side * -0.06, weight_fn=w_head
        )
        # Subtle nostril shadow crease under alar wings
        pupil_mb.add_ellipsoid(
            side * 0.010, 1.472, 0.179, 0.0045, 0.0025, 0.006, lat_segs=6, lon_segs=8, weight_fn=w_head
        )

    # Sculpted Cupid's-bow upper lip & fuller lower lip positioned clearly in front of the chin/mouth surface (z=0.174..0.178)
    for side in (-1.0, 1.0):
        mouth_mb.add_ellipsoid(
            side * 0.010, 1.446, 0.175, 0.017, 0.0062, 0.011, lat_segs=8, lon_segs=12, rot_z=side * 0.09, weight_fn=w_head
        )
    mouth_mb.add_ellipsoid(
        0.0, 1.437, 0.174, 0.025, 0.0078, 0.011, lat_segs=8, lon_segs=12, weight_fn=w_head
    )
    # Oral commissure seam line between upper and lower lips
    pupil_mb.add_ellipsoid(
        0.0, 1.441, 0.178, 0.023, 0.0022, 0.008, lat_segs=6, lon_segs=10, weight_fn=w_head
    )
    return sclera_mb, pupil_mb, mouth_mb


def build_glasses_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)
    for side in (-1.0, 1.0):
        # Upper & lower frame bars so eyes remain visible inside glasses
        mb.add_ellipsoid(
            side * 0.055, 1.544, 0.168, 0.034, 0.004, 0.005, lat_segs=6, lon_segs=10, weight_fn=w_head
        )
        mb.add_ellipsoid(
            side * 0.055, 1.492, 0.167, 0.032, 0.0035, 0.005, lat_segs=6, lon_segs=10, weight_fn=w_head
        )
        mb.add_ellipsoid(
            side * 0.088, 1.518, 0.165, 0.004, 0.026, 0.005, lat_segs=6, lon_segs=8, weight_fn=w_head
        )
        mb.add_ellipsoid(
            side * 0.022, 1.518, 0.168, 0.004, 0.026, 0.005, lat_segs=6, lon_segs=8, weight_fn=w_head
        )
        # Temple arms extending back to ears
        mb.add_ellipsoid(
            side * 0.125, 1.522, 0.082, 0.004, 0.004, 0.085, lat_segs=6, lon_segs=8, weight_fn=w_head
        )
    mb.add_ellipsoid(0.0, 1.528, 0.169, 0.024, 0.004, 0.005, lat_segs=6, lon_segs=8, weight_fn=w_head)
    return mb


def add_base_cranial_hair(mb: SkinnedMeshBuilder) -> None:
    w_head = weight_rigid(J_HEAD)
    # Full cranial crown dome tilted back cleanly so it never z-fights with the forehead skin
    mb.add_ellipsoid(
        0.0,
        1.556,
        -0.018,
        0.169,
        0.174,
        0.174,
        lat_segs=14,
        lon_segs=22,
        theta_max=math.pi * 0.62,
        rot_x=-0.30,
        weight_fn=w_head,
    )
    # Nape / back-of-head volume
    mb.add_ellipsoid(
        0.0, 1.502, -0.052, 0.152, 0.156, 0.152, lat_segs=12, lon_segs=18, weight_fn=w_head
    )
    # Left & right temple sideburn locks
    for side in (-1.0, 1.0):
        mb.add_ellipsoid(
            side * 0.145,
            1.535,
            0.032,
            0.032,
            0.072,
            0.038,
            lat_segs=8,
            lon_segs=10,
            rot_x=0.15,
            rot_z=side * 0.08,
            weight_fn=w_head,
        )


def build_hair_quiff_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)
    add_base_cranial_hair(mb)
    # Sculpted multi-layered textured top volume & swept front wave quiff
    mb.add_ellipsoid(0.0, 1.658, 0.025, 0.122, 0.068, 0.078, lat_segs=10, lon_segs=16, weight_fn=w_head)
    mb.add_ellipsoid(
        0.015, 1.652, 0.098, 0.118, 0.058, 0.066, lat_segs=10, lon_segs=16, rot_x=0.26, rot_z=-0.08, weight_fn=w_head
    )
    mb.add_ellipsoid(
        -0.045, 1.638, 0.078, 0.075, 0.048, 0.055, lat_segs=8, lon_segs=12, rot_x=0.18, rot_z=0.16, weight_fn=w_head
    )
    return mb


def build_hair_ponytail_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)
    add_base_cranial_hair(mb)
    # Curtain swept front bangs framing forehead & cheekbones
    for side in (-1.0, 1.0):
        mb.add_ellipsoid(
            side * 0.068,
            1.624,
            0.106,
            0.082,
            0.044,
            0.048,
            lat_segs=8,
            lon_segs=12,
            rot_z=side * -0.35,
            weight_fn=w_head,
        )
        mb.add_ellipsoid(
            side * 0.132,
            1.515,
            0.065,
            0.028,
            0.085,
            0.032,
            lat_segs=8,
            lon_segs=10,
            rot_z=side * -0.08,
            weight_fn=w_head,
        )
    # Back hair bun + full cascading S-curve ponytail
    mb.add_ellipsoid(0.0, 1.555, -0.188, 0.078, 0.078, 0.078, lat_segs=10, lon_segs=14, weight_fn=w_head)
    mb.add_ellipsoid(
        0.0, 1.448, -0.224, 0.058, 0.128, 0.058, lat_segs=10, lon_segs=14, rot_x=0.38, weight_fn=w_head
    )
    mb.add_ellipsoid(
        0.0, 1.345, -0.242, 0.042, 0.085, 0.042, lat_segs=8, lon_segs=12, rot_x=0.18, weight_fn=w_head
    )
    return mb


def build_hair_bob_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)
    add_base_cranial_hair(mb)
    # Forehead fringe bangs
    mb.add_ellipsoid(0.0, 1.628, 0.110, 0.116, 0.046, 0.050, lat_segs=8, lon_segs=14, weight_fn=w_head)
    # Left, right, and back layered jaw-length bob locks
    for side in (-1.0, 1.0):
        mb.add_ellipsoid(
            side * 0.138,
            1.472,
            0.022,
            0.052,
            0.135,
            0.068,
            lat_segs=10,
            lon_segs=14,
            rot_z=side * -0.06,
            weight_fn=w_head,
        )
        mb.add_ellipsoid(
            side * 0.115,
            1.455,
            -0.065,
            0.054,
            0.125,
            0.065,
            lat_segs=10,
            lon_segs=14,
            weight_fn=w_head,
        )
    return mb


def build_hair_cap_mesh() -> SkinnedMeshBuilder:
    mb = SkinnedMeshBuilder()
    w_head = weight_rigid(J_HEAD)
    add_base_cranial_hair(mb)
    # Cap dome + top button + curved front visor
    mb.add_ellipsoid(
        0.0,
        1.552,
        -0.006,
        0.176,
        0.178,
        0.184,
        lat_segs=12,
        lon_segs=20,
        theta_max=math.pi * 0.54,
        weight_fn=w_head,
    )
    mb.add_ellipsoid(0.0, 1.728, -0.006, 0.018, 0.010, 0.018, lat_segs=6, lon_segs=8, weight_fn=w_head)
    mb.add_ellipsoid(
        0.0,
        1.584,
        0.145,
        0.134,
        0.015,
        0.098,
        lat_segs=8,
        lon_segs=16,
        rot_x=0.16,
        weight_fn=w_head,
    )
    return mb


def euler_to_quat(rx: float, ry: float, rz: float) -> Tuple[float, float, float, float]:
    """Converts XYZ intrinsic Euler angles (matching THREE.Euler default 'XYZ') to (qx, qy, qz, qw)."""
    c1 = math.cos(rx * 0.5)
    c2 = math.cos(ry * 0.5)
    c3 = math.cos(rz * 0.5)
    s1 = math.sin(rx * 0.5)
    s2 = math.sin(ry * 0.5)
    s3 = math.sin(rz * 0.5)

    qx = s1 * c2 * c3 + c1 * s2 * s3
    qy = c1 * s2 * c3 - s1 * c2 * s3
    qz = c1 * c2 * s3 + s1 * s2 * c3
    qw = c1 * c2 * c3 - s1 * s2 * s3
    return (qx, qy, qz, qw)


def sample_skeletal_clip(clip_name: str, t: float, duration: float) -> Dict[int, Dict[str, Tuple]]:
    """
    Evaluates bone-local translations and rotations for all 15 humanoid joints at time `t`
    so the GLB contains 7 self-contained, loop-seamless skeletal animations.
    """
    phase = (t / duration) * math.pi * 2.0
    w_phase = (t / duration) * math.pi * 4.0  # 2 full stride cycles per 2.0s clip

    # Default bind-pose local bone rotations (Euler XYZ) and Hips local translation
    hips_pos = [0.0, 0.72, 0.0]
    rot: Dict[int, Tuple[float, float, float]] = {j: (0.0, 0.0, 0.0) for j in range(15)}

    if clip_name == "walk":
        swing = math.sin(w_phase) * 0.52
        bounce = abs(math.cos(w_phase)) * 0.032
        l_knee = max(0.0, -math.cos(w_phase)) * 0.56
        r_knee = max(0.0, math.cos(w_phase)) * 0.56
        hips_pos = [math.cos(w_phase * 0.5) * 0.012, 0.72 + bounce, 0.0]
        rot[J_HIPS] = (0.02, math.sin(w_phase) * 0.05, math.cos(w_phase) * 0.025)
        rot[J_SPINE] = (0.03, -math.sin(w_phase) * 0.06, 0.0)
        rot[J_CHEST] = (0.02, -math.sin(w_phase) * 0.06, -math.cos(w_phase) * 0.02)
        rot[J_NECK] = (0.0, math.sin(w_phase) * 0.03, 0.0)
        rot[J_HEAD] = (-0.02, math.sin(w_phase) * 0.04, 0.0)
        rot[J_L_ARM] = (-swing * 0.72, 0.0, 0.05)
        rot[J_L_FOREARM] = (-0.22 - max(0.0, swing) * 0.34, 0.0, 0.0)
        rot[J_R_ARM] = (swing * 0.72, 0.0, -0.05)
        rot[J_R_FOREARM] = (-0.22 - max(0.0, -swing) * 0.34, 0.0, 0.0)
        rot[J_L_UPLEG] = (swing, 0.0, 0.0)
        rot[J_L_LEG] = (l_knee, 0.0, 0.0)
        rot[J_L_FOOT] = (-swing * 0.35 - l_knee * 0.25, 0.0, 0.0)
        rot[J_R_UPLEG] = (-swing, 0.0, 0.0)
        rot[J_R_LEG] = (r_knee, 0.0, 0.0)
        rot[J_R_FOOT] = (swing * 0.35 - r_knee * 0.25, 0.0, 0.0)

    elif clip_name == "idle_queue":
        breath = math.sin(phase) * 0.012
        shift = math.sin(phase) * 0.032
        look_up = -0.14 * max(0.0, math.sin(phase))
        hips_pos = [shift * 0.25, 0.72 + breath, 0.0]
        rot[J_HIPS] = (0.0, math.sin(phase) * 0.03, shift * 0.5)
        rot[J_SPINE] = (breath * 0.4, math.sin(phase) * 0.03, -shift * 0.25)
        rot[J_CHEST] = (breath * 0.5, 0.0, -shift * 0.25)
        rot[J_HEAD] = (look_up, math.sin(phase) * 0.16, 0.0)
        rot[J_L_ARM] = (-0.08 + math.sin(phase) * 0.04, 0.0, 0.06)
        rot[J_L_FOREARM] = (-0.24, 0.0, -0.06)
        rot[J_R_ARM] = (-0.06 - math.sin(phase) * 0.04, 0.0, -0.06)
        rot[J_R_FOREARM] = (-0.20, 0.0, 0.04)
        rot[J_L_UPLEG] = (shift * 0.3, 0.0, 0.0)
        rot[J_L_LEG] = (0.04, 0.0, 0.0)
        rot[J_R_UPLEG] = (-shift * 0.3, 0.0, 0.0)
        rot[J_R_LEG] = (0.04, 0.0, 0.0)

    elif clip_name == "ordering":
        wave = math.sin(phase * 2.0)
        nod = math.sin(phase * 2.0) * 0.10
        hips_pos = [0.0, 0.72 + abs(math.sin(phase)) * 0.014, 0.0]
        rot[J_HIPS] = (0.03, -0.05, 0.0)
        rot[J_SPINE] = (0.04, -0.04 + math.sin(phase) * 0.04, 0.01)
        rot[J_CHEST] = (0.03, -0.03 + math.sin(phase) * 0.04, 0.01)
        rot[J_HEAD] = (nod - 0.04, math.sin(phase) * 0.12, math.sin(phase) * 0.04)
        rot[J_L_ARM] = (-0.25 + math.sin(phase) * 0.07, 0.0, 0.08)
        rot[J_L_FOREARM] = (-0.36, 0.0, 0.0)
        rot[J_R_ARM] = (-1.18 + wave * 0.20, 0.0, -0.16 + math.cos(phase * 2.0) * 0.10)
        rot[J_R_FOREARM] = (-0.42 + wave * 0.16, 0.0, 0.0)

    elif clip_name == "idle_waiting_food":
        breath = math.sin(phase) * 0.014
        peek = math.sin(phase) * 0.22
        tap = max(0.0, math.sin(phase * 2.0))
        hips_pos = [0.0, 0.72 + breath, 0.0]
        rot[J_HIPS] = (0.01, peek * 0.15, 0.0)
        rot[J_SPINE] = (0.02, peek * 0.18, math.sin(phase) * 0.02)
        rot[J_CHEST] = (0.01, peek * 0.15, 0.0)
        rot[J_HEAD] = (-0.04 + math.sin(phase) * 0.04, peek * 0.85, 0.0)
        rot[J_L_ARM] = (-0.36 + tap * 0.04, 0.0, 0.14)
        rot[J_L_FOREARM] = (-0.62, 0.0, -0.22)
        rot[J_R_ARM] = (-0.26 - tap * 0.03, 0.0, -0.10)
        rot[J_R_FOREARM] = (-0.48, 0.0, 0.12)
        rot[J_L_UPLEG] = (-tap * 0.08, 0.0, 0.0)
        rot[J_L_LEG] = (tap * 0.14, 0.0, 0.0)

    elif clip_name == "impatient_watch":
        check = math.sin(phase)
        looking = check > -0.25
        foot_tap = abs(math.sin(phase * 3.0)) * 0.14
        hips_pos = [0.0, 0.72 + math.sin(phase * 2.0) * 0.012, 0.0]
        rot[J_SPINE] = (0.05 if looking else 0.02, 0.08 if looking else -0.08, 0.0)
        rot[J_CHEST] = (0.04 if looking else 0.01, 0.06 if looking else -0.06, 0.0)
        rot[J_HEAD] = (0.34 if looking else -0.04, 0.26 if looking else math.sin(phase * 2.0) * 0.14, -0.08 if looking else 0.0)
        rot[J_L_ARM] = (-0.92 if looking else -0.45, 0.0, -0.20 if looking else 0.10)
        rot[J_L_FOREARM] = (-1.12 if looking else -0.52, 0.0, -0.60 if looking else -0.20)
        rot[J_R_ARM] = (-0.32 + math.sin(phase * 2.0) * 0.06, 0.0, -0.16)
        rot[J_R_FOREARM] = (-0.72, 0.0, 0.0)
        rot[J_L_UPLEG] = (-foot_tap, 0.0, 0.0)
        rot[J_L_LEG] = (foot_tap * 1.4, 0.0, 0.0)

    elif clip_name == "receiving_happy":
        hop = abs(math.sin(phase * 2.0)) * 0.048
        wave = math.sin(phase * 3.0) * 0.22
        hips_pos = [0.0, 0.72 + hop, 0.0]
        rot[J_SPINE] = (-0.04, math.sin(phase * 2.0) * 0.08, 0.0)
        rot[J_CHEST] = (-0.03, math.sin(phase * 2.0) * 0.08, 0.0)
        rot[J_HEAD] = (-0.08 + math.sin(phase * 2.0) * 0.08, math.sin(phase * 2.0) * 0.12, 0.0)
        rot[J_L_ARM] = (-2.25 + wave, 0.0, 0.20)
        rot[J_L_FOREARM] = (-0.32, 0.0, 0.0)
        rot[J_R_ARM] = (-2.25 - wave, 0.0, -0.20)
        rot[J_R_FOREARM] = (-0.32, 0.0, 0.0)
        rot[J_L_UPLEG] = (-hop * 1.5, 0.0, 0.0)
        rot[J_L_LEG] = (hop * 2.0, 0.0, 0.0)
        rot[J_R_UPLEG] = (hop * 1.2, 0.0, 0.0)
        rot[J_R_LEG] = (hop * 1.8, 0.0, 0.0)

    elif clip_name == "leaving_angry":
        swing = math.sin(w_phase) * 0.66
        stomp = abs(math.cos(w_phase)) * 0.044
        l_knee = max(0.0, -math.cos(w_phase)) * 0.64
        r_knee = max(0.0, math.cos(w_phase)) * 0.64
        hips_pos = [0.0, 0.72 + stomp, 0.0]
        rot[J_HIPS] = (0.06, math.sin(w_phase) * 0.08, math.cos(w_phase) * 0.04)
        rot[J_SPINE] = (0.05, -math.sin(w_phase) * 0.07, 0.0)
        rot[J_CHEST] = (0.05, -math.sin(w_phase) * 0.07, 0.0)
        rot[J_HEAD] = (0.10, math.sin(w_phase * 1.5) * 0.20, 0.0)
        rot[J_L_ARM] = (-swing * 0.88, 0.0, 0.14)
        rot[J_L_FOREARM] = (-0.54, 0.0, 0.0)
        rot[J_R_ARM] = (swing * 0.88, 0.0, -0.14)
        rot[J_R_FOREARM] = (-0.54, 0.0, 0.0)
        rot[J_L_UPLEG] = (swing, 0.0, 0.0)
        rot[J_L_LEG] = (l_knee, 0.0, 0.0)
        rot[J_R_UPLEG] = (-swing, 0.0, 0.0)
        rot[J_R_LEG] = (r_knee, 0.0, 0.0)

    elif clip_name == "sit_down":
        u = max(0.0, min(1.0, t / duration))
        s = u * u * (3.0 - 2.0 * u)
        lean = math.sin(u * math.pi) * 0.18 + s * 0.04
        hips_pos = [0.0, 0.72 - s * 0.275, -s * 0.06]
        rot[J_HIPS] = (lean * 0.35, 0.0, 0.0)
        rot[J_SPINE] = (lean * 0.45, 0.0, 0.0)
        rot[J_CHEST] = (lean * 0.35, 0.0, 0.0)
        rot[J_HEAD] = (s * 0.06, 0.0, 0.0)
        rot[J_L_ARM] = (-s * 0.90, 0.0, 0.12)
        rot[J_L_FOREARM] = (-s * 0.52, 0.0, -0.22 * s)
        rot[J_R_ARM] = (-s * 0.90, 0.0, -0.12)
        rot[J_R_FOREARM] = (-s * 0.52, 0.0, 0.22 * s)
        rot[J_L_UPLEG] = (-s * 1.35, 0.0, -0.05 * s)
        rot[J_L_LEG] = (s * 1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-s * 1.35, 0.0, 0.05 * s)
        rot[J_R_LEG] = (s * 1.35, 0.0, 0.0)

    elif clip_name == "seated_eat":
        raw_wave = math.sin(phase - math.pi * 0.42)
        bite = max(0.0, min(1.0, (raw_wave + 0.25) / 1.25))
        chew = math.sin(phase * 4.0) * 0.065 if bite > 0.55 else math.sin(phase * 2.0) * 0.02
        hips_pos = [0.0, 0.445 + math.sin(phase) * 0.004, -0.06]
        rot[J_HIPS] = (0.03, 0.0, 0.0)
        rot[J_SPINE] = (0.05 + bite * 0.07, math.sin(phase) * 0.025, 0.0)
        rot[J_CHEST] = (0.04 + bite * 0.05, 0.0, 0.0)
        rot[J_HEAD] = (0.07 + bite * 0.14 + chew * 0.5, math.sin(phase) * 0.04, 0.0)
        # Hands reach tray (bite=0) and bring burger cleanly to mouth (bite=1)
        rot[J_L_ARM] = (-0.90 - bite * 0.42, 0.16 + bite * 0.18, 0.12)
        rot[J_L_FOREARM] = (-0.50 - bite * 0.38, 0.0, -0.30 - bite * 0.16)
        rot[J_R_ARM] = (-0.92 - bite * 0.44, -0.16 - bite * 0.18, -0.12)
        rot[J_R_FOREARM] = (-0.52 - bite * 0.40, 0.0, 0.30 + bite * 0.16)
        rot[J_L_UPLEG] = (-1.35, 0.0, -0.05)
        rot[J_L_LEG] = (1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-1.35, 0.0, 0.05)
        rot[J_R_LEG] = (1.35, 0.0, 0.0)

    elif clip_name == "seated_drink":
        raw_sip = math.sin(phase - math.pi * 0.42)
        sip = max(0.0, min(1.0, (raw_sip + 0.25) / 1.25))
        hips_pos = [0.0, 0.445 + math.sin(phase) * 0.003, -0.06]
        rot[J_HIPS] = (0.02, 0.0, 0.0)
        rot[J_SPINE] = (0.03 - sip * 0.03, 0.0, 0.0)
        rot[J_CHEST] = (0.02 - sip * 0.02, 0.0, 0.0)
        rot[J_HEAD] = (0.04 + sip * 0.05, math.sin(phase) * 0.03, 0.0)
        rot[J_L_ARM] = (-0.88, 0.10, 0.10)
        rot[J_L_FOREARM] = (-0.48, 0.0, -0.22)
        rot[J_R_ARM] = (-0.90 - sip * 0.44, -0.15 - sip * 0.14, -0.12)
        rot[J_R_FOREARM] = (-0.54 - sip * 0.42, 0.0, 0.26 + sip * 0.12)
        rot[J_L_UPLEG] = (-1.35, 0.0, -0.05)
        rot[J_L_LEG] = (1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-1.35, 0.0, 0.05)
        rot[J_R_LEG] = (1.35, 0.0, 0.0)

    elif clip_name == "seated_phone":
        scroll = math.sin(phase * 2.0) * 0.05
        hips_pos = [0.0, 0.445, -0.06]
        rot[J_HIPS] = (0.03, 0.0, 0.0)
        rot[J_SPINE] = (0.05, 0.0, 0.0)
        rot[J_CHEST] = (0.04, 0.0, 0.0)
        rot[J_HEAD] = (0.24 + scroll * 0.2, math.sin(phase) * 0.05, -0.03)
        rot[J_L_ARM] = (-0.88, 0.10, 0.10)
        rot[J_L_FOREARM] = (-0.48, 0.0, -0.22)
        rot[J_R_ARM] = (-1.02 + scroll, -0.18, -0.14)
        rot[J_R_FOREARM] = (-0.72 - scroll, 0.0, 0.30)
        rot[J_L_UPLEG] = (-1.35, 0.0, -0.05)
        rot[J_L_LEG] = (1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-1.35, 0.0, 0.05)
        rot[J_R_LEG] = (1.35, 0.0, 0.0)

    elif clip_name == "seated_idle_look":
        nod = math.sin(phase * 2.0) * 0.085
        gesture = math.sin(phase) * 0.14
        hips_pos = [0.0, 0.445 + math.sin(phase) * 0.004, -0.06]
        rot[J_HIPS] = (0.02, 0.0, 0.0)
        rot[J_SPINE] = (0.04 + abs(gesture) * 0.04, math.sin(phase) * 0.07, 0.0)
        rot[J_CHEST] = (0.03, math.sin(phase) * 0.07, 0.0)
        rot[J_HEAD] = (nod - 0.02, math.sin(phase) * 0.20, math.sin(phase) * 0.05)
        rot[J_L_ARM] = (-0.90 + gesture * 0.45, 0.14, 0.10)
        rot[J_L_FOREARM] = (-0.50 - max(0.0, gesture) * 0.28, 0.0, -0.24)
        rot[J_R_ARM] = (-0.92 - gesture * 0.52, -0.14, -0.10)
        rot[J_R_FOREARM] = (-0.54 - max(0.0, -gesture) * 0.32, 0.0, 0.26)
        rot[J_L_UPLEG] = (-1.35, 0.0, -0.05)
        rot[J_L_LEG] = (1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-1.35, 0.0, 0.05)
        rot[J_R_LEG] = (1.35, 0.0, 0.0)

    elif clip_name == "stand_up":
        u = max(0.0, min(1.0, t / duration))
        s = 1.0 - u * u * (3.0 - 2.0 * u)
        lean = math.sin(u * math.pi) * 0.18 + s * 0.04
        hips_pos = [0.0, 0.72 - s * 0.275, -s * 0.06]
        rot[J_HIPS] = (lean * 0.35, 0.0, 0.0)
        rot[J_SPINE] = (lean * 0.45, 0.0, 0.0)
        rot[J_CHEST] = (lean * 0.35, 0.0, 0.0)
        rot[J_HEAD] = (s * 0.06, 0.0, 0.0)
        rot[J_L_ARM] = (-s * 0.90, 0.0, 0.12)
        rot[J_L_FOREARM] = (-s * 0.52, 0.0, -0.22 * s)
        rot[J_R_ARM] = (-s * 0.90, 0.0, -0.12)
        rot[J_R_FOREARM] = (-s * 0.52, 0.0, 0.22 * s)
        rot[J_L_UPLEG] = (-s * 1.35, 0.0, -0.05 * s)
        rot[J_L_LEG] = (s * 1.35, 0.0, 0.0)
        rot[J_R_UPLEG] = (-s * 1.35, 0.0, 0.05 * s)
        rot[J_R_LEG] = (s * 1.35, 0.0, 0.0)

    out: Dict[int, Dict[str, Tuple]] = {}
    for j in range(15):
        rx, ry, rz = rot[j]
        entry: Dict[str, Tuple] = {"rotation": euler_to_quat(rx, ry, rz)}
        if j == J_HIPS:
            entry["translation"] = (hips_pos[0], hips_pos[1], hips_pos[2])
        out[j] = entry
    return out


def compile_customer_glb(out_path: str) -> None:
    albedo_png, orm_png, norm_png = build_fabric_pbr_textures(256)

    strap_mb, brass_mb = build_belt_and_watch_mesh()
    sclera_mb, pupil_mb, mouth_mb = build_face_features_meshes()

    # Material indices:
    # 0: Mat_Shirt
    # 1: Mat_Jacket
    # 2: Mat_Pants
    # 3: Mat_Skin
    # 4: Mat_Shoe
    # 5: Mat_Sole
    # 6: Mat_Hair
    # 7: Mat_Dark
    # 8: Mat_Brass
    # 9: Mat_White
    # 10: Mat_Mouth
    skinned_meshes_spec: List[Tuple[str, SkinnedMeshBuilder, int]] = [
        ("SkinBodyMesh", build_skin_body_mesh(), 3),
        ("ShirtTorsoMesh", build_shirt_torso_mesh(), 0),
        ("JacketOuterMesh", build_jacket_outer_mesh(), 1),
        ("TrousersMesh", build_trousers_mesh(), 2),
        ("SneakerUppersMesh", build_sneaker_uppers_mesh(), 4),
        ("SneakerSolesMesh", build_sneaker_soles_mesh(), 5),
        ("BeltAndStrapMesh", strap_mb, 7),
        ("BuckleAndWatchMesh", brass_mb, 8),
        ("EyeScleraMesh", sclera_mb, 9),
        ("EyePupilAndBrowMesh", pupil_mb, 7),
        ("MouthAndBlushMesh", mouth_mb, 10),
        ("GlassesMesh", build_glasses_mesh(), 7),
        ("Hair_quiff", build_hair_quiff_mesh(), 6),
        ("Hair_ponytail", build_hair_ponytail_mesh(), 6),
        ("Hair_bob", build_hair_bob_mesh(), 6),
        ("Hair_cap", build_hair_cap_mesh(), 1),
    ]

    bin_blob = bytearray()
    buffer_views = []
    accessors = []

    def append_bytes(data: bytes, target: Optional[int] = None) -> int:
        while len(bin_blob) % 4 != 0:
            bin_blob.append(0)
        offset = len(bin_blob)
        bin_blob.extend(data)
        while len(bin_blob) % 4 != 0:
            bin_blob.append(0)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            bv["target"] = target
        idx = len(buffer_views)
        buffer_views.append(bv)
        return idx

    # 1. Embed PBR textures
    albedo_bv = append_bytes(albedo_png)
    orm_bv = append_bytes(orm_png)
    norm_bv = append_bytes(norm_png)

    # 2. Build Node Hierarchy:
    # Node 0: CustomerRoot
    # Nodes 1..15: 15 Skeleton Joint Nodes (Hips..RightFoot)
    # Nodes 16..31: SkinnedMesh Nodes referencing skin=0
    nodes: List[Dict] = [
        {"name": "CustomerRoot", "children": [1] + list(range(16, 16 + len(skinned_meshes_spec)))}
    ]

    joint_children: Dict[int, List[int]] = {j: [] for j in range(15)}
    for j_idx, (_, _, parent_j) in enumerate(JOINT_BIND_WORLD):
        if parent_j is not None:
            joint_children[parent_j].append(1 + j_idx)

    for j_idx, (j_name, (wx, wy, wz), parent_j) in enumerate(JOINT_BIND_WORLD):
        if parent_j is None:
            lx, ly, lz = wx, wy, wz
        else:
            px, py, pz = JOINT_BIND_WORLD[parent_j][1]
            lx, ly, lz = wx - px, wy - py, wz - pz
        node_def: Dict = {
            "name": j_name,
            "translation": [round(lx, 5), round(ly, 5), round(lz, 5)],
            "rotation": [0.0, 0.0, 0.0, 1.0],
        }
        if joint_children[j_idx]:
            node_def["children"] = joint_children[j_idx]
        nodes.append(node_def)

    # 3. InverseBindMatrices for the 15 joints (column-major 4x4 float32)
    ibm_bytes = bytearray()
    for _, (wx, wy, wz), _ in JOINT_BIND_WORLD:
        # Column-major 4x4 translation matrix T(-wx, -wy, -wz)
        ibm_mat = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            -wx, -wy, -wz, 1.0,
        ]
        ibm_bytes.extend(struct.pack("<16f", *ibm_mat))

    ibm_bv = append_bytes(bytes(ibm_bytes))
    ibm_acc = len(accessors)
    accessors.append(
        {
            "bufferView": ibm_bv,
            "componentType": 5126,
            "count": len(JOINT_BIND_WORLD),
            "type": "MAT4",
        }
    )

    skins_gltf = [
        {
            "name": "CustomerHumanoidSkin",
            "skeleton": 1,
            "joints": list(range(1, 16)),
            "inverseBindMatrices": ibm_acc,
        }
    ]

    # 4. Serialize Skinned Meshes with POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0
    meshes_gltf = []
    for mesh_idx, (name, mb, mat_index) in enumerate(skinned_meshes_spec):
        pos_bytes = bytearray()
        norm_bytes = bytearray()
        uv_bytes = bytearray()
        joints_bytes = bytearray()
        weights_bytes = bytearray()
        idx_bytes = bytearray()

        min_p = [1e9, 1e9, 1e9]
        max_p = [-1e9, -1e9, -1e9]

        for px, py, pz in mb.positions:
            pos_bytes.extend(struct.pack("<fff", px, py, pz))
            min_p[0] = min(min_p[0], px)
            min_p[1] = min(min_p[1], py)
            min_p[2] = min(min_p[2], pz)
            max_p[0] = max(max_p[0], px)
            max_p[1] = max(max_p[1], py)
            max_p[2] = max(max_p[2], pz)

        for nx, ny, nz in mb.normals:
            norm_bytes.extend(struct.pack("<fff", nx, ny, nz))

        for u, v in mb.uvs:
            uv_bytes.extend(struct.pack("<ff", u, v))

        for j0, j1, j2, j3 in mb.joints:
            joints_bytes.extend(struct.pack("<BBBB", j0, j1, j2, j3))

        for w0, w1, w2, w3 in mb.weights:
            weights_bytes.extend(struct.pack("<ffff", w0, w1, w2, w3))

        for idx in mb.indices:
            idx_bytes.extend(struct.pack("<H", idx))

        pos_bv = append_bytes(bytes(pos_bytes), 34962)
        norm_bv_i = append_bytes(bytes(norm_bytes), 34962)
        uv_bv = append_bytes(bytes(uv_bytes), 34962)
        j_bv = append_bytes(bytes(joints_bytes), 34962)
        w_bv = append_bytes(bytes(weights_bytes), 34962)
        ind_bv = append_bytes(bytes(idx_bytes), 34963)

        v_count = len(mb.positions)
        pos_acc = len(accessors)
        accessors.append(
            {
                "bufferView": pos_bv,
                "componentType": 5126,
                "count": v_count,
                "type": "VEC3",
                "min": [round(x, 5) for x in min_p],
                "max": [round(x, 5) for x in max_p],
            }
        )
        norm_acc = len(accessors)
        accessors.append(
            {
                "bufferView": norm_bv_i,
                "componentType": 5126,
                "count": v_count,
                "type": "VEC3",
            }
        )
        uv_acc = len(accessors)
        accessors.append(
            {
                "bufferView": uv_bv,
                "componentType": 5126,
                "count": v_count,
                "type": "VEC2",
            }
        )
        j_acc = len(accessors)
        accessors.append(
            {
                "bufferView": j_bv,
                "componentType": 5121,  # UNSIGNED_BYTE
                "count": v_count,
                "type": "VEC4",
            }
        )
        w_acc = len(accessors)
        accessors.append(
            {
                "bufferView": w_bv,
                "componentType": 5126,  # FLOAT
                "count": v_count,
                "type": "VEC4",
            }
        )
        ind_acc = len(accessors)
        accessors.append(
            {
                "bufferView": ind_bv,
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": len(mb.indices),
                "type": "SCALAR",
            }
        )

        meshes_gltf.append(
            {
                "name": name,
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": pos_acc,
                            "NORMAL": norm_acc,
                            "TEXCOORD_0": uv_acc,
                            "JOINTS_0": j_acc,
                            "WEIGHTS_0": w_acc,
                        },
                        "indices": ind_acc,
                        "material": mat_index,
                    }
                ],
            }
        )

        # Add SkinnedMesh node referencing mesh_idx and skin=0
        nodes.append(
            {
                "name": name,
                "mesh": mesh_idx,
                "skin": 0,
            }
        )

    # 5. Build 13 Embedded Skeletal Keyframe Animations (7 standing/walking + 6 seated dining)
    clip_names = [
        "walk",
        "idle_queue",
        "ordering",
        "idle_waiting_food",
        "impatient_watch",
        "receiving_happy",
        "leaving_angry",
        "sit_down",
        "seated_eat",
        "seated_drink",
        "seated_phone",
        "seated_idle_look",
        "stand_up",
    ]
    duration = 2.0
    num_samples = 20
    times = [(i / float(num_samples)) * duration for i in range(num_samples + 1)]
    time_bytes = struct.pack(f"<{len(times)}f", *times)
    time_bv = append_bytes(time_bytes)
    time_acc = len(accessors)
    accessors.append(
        {
            "bufferView": time_bv,
            "componentType": 5126,
            "count": len(times),
            "type": "SCALAR",
            "min": [0.0],
            "max": [duration],
        }
    )

    animations_gltf = []
    for clip_name in clip_names:
        samplers = []
        channels = []

        # Sample all keyframes
        frames = [sample_skeletal_clip(clip_name, t, duration) for t in times]

        # Hips translation track
        hips_trans_bytes = bytearray()
        for f in frames:
            tx, ty, tz = f[J_HIPS]["translation"]
            hips_trans_bytes.extend(struct.pack("<fff", tx, ty, tz))
        ht_bv = append_bytes(bytes(hips_trans_bytes))
        ht_acc = len(accessors)
        accessors.append(
            {
                "bufferView": ht_bv,
                "componentType": 5126,
                "count": len(times),
                "type": "VEC3",
            }
        )
        s_idx = len(samplers)
        samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": ht_acc})
        channels.append({"sampler": s_idx, "target": {"node": 1 + J_HIPS, "path": "translation"}})

        # Rotation tracks for all 15 joints
        for j_idx in range(15):
            rot_bytes = bytearray()
            for f in frames:
                qx, qy, qz, qw = f[j_idx]["rotation"]
                rot_bytes.extend(struct.pack("<ffff", qx, qy, qz, qw))
            r_bv = append_bytes(bytes(rot_bytes))
            r_acc = len(accessors)
            accessors.append(
                {
                    "bufferView": r_bv,
                    "componentType": 5126,
                    "count": len(times),
                    "type": "VEC4",
                }
            )
            s_idx = len(samplers)
            samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": r_acc})
            channels.append({"sampler": s_idx, "target": {"node": 1 + j_idx, "path": "rotation"}})

        animations_gltf.append(
            {
                "name": clip_name,
                "samplers": samplers,
                "channels": channels,
            }
        )

    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "BurgerDistrict-CustomerSkinnedCompiler-v2.2",
        },
        "scene": 0,
        "scenes": [{"name": "CustomerCharacterScene", "nodes": [0]}],
        "nodes": nodes,
        "skins": skins_gltf,
        "meshes": meshes_gltf,
        "animations": animations_gltf,
        "images": [
            {"name": "FabricAlbedo", "bufferView": albedo_bv, "mimeType": "image/png"},
            {"name": "FabricORM", "bufferView": orm_bv, "mimeType": "image/png"},
            {"name": "FabricNormal", "bufferView": norm_bv, "mimeType": "image/png"},
        ],
        "samplers": [
            {"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}
        ],
        "textures": [
            {"source": 0, "sampler": 0},
            {"source": 1, "sampler": 0},
            {"source": 2, "sampler": 0},
        ],
        "materials": [
            {
                "name": "Mat_Shirt",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicRoughnessTexture": {"index": 1},
                    "metallicFactor": 0.04,
                    "roughnessFactor": 0.68,
                },
                "normalTexture": {"index": 2, "scale": 0.50},
                "occlusionTexture": {"index": 1, "strength": 0.8},
            },
            {
                "name": "Mat_Jacket",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicRoughnessTexture": {"index": 1},
                    "metallicFactor": 0.06,
                    "roughnessFactor": 0.58,
                },
                "normalTexture": {"index": 2, "scale": 0.60},
                "occlusionTexture": {"index": 1, "strength": 0.85},
                "doubleSided": True,
            },
            {
                "name": "Mat_Pants",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicRoughnessTexture": {"index": 1},
                    "metallicFactor": 0.04,
                    "roughnessFactor": 0.76,
                },
                "normalTexture": {"index": 2, "scale": 0.65},
                "occlusionTexture": {"index": 1, "strength": 0.85},
            },
            {
                "name": "Mat_Skin",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.95, 0.76, 0.49, 1.0],
                    "metallicFactor": 0.02,
                    "roughnessFactor": 0.46,
                },
            },
            {
                "name": "Mat_Shoe",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": 0.06,
                    "roughnessFactor": 0.42,
                },
                "normalTexture": {"index": 2, "scale": 0.35},
            },
            {
                "name": "Mat_Sole",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.96, 0.96, 0.98, 1.0],
                    "metallicFactor": 0.02,
                    "roughnessFactor": 0.52,
                },
            },
            {
                "name": "Mat_Hair",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.18, 0.12, 0.08, 1.0],
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.54,
                },
            },
            {
                "name": "Mat_Dark",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.09, 0.10, 0.14, 1.0],
                    "metallicFactor": 0.25,
                    "roughnessFactor": 0.22,
                },
            },
            {
                "name": "Mat_Brass",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.98, 0.75, 0.15, 1.0],
                    "metallicFactor": 0.85,
                    "roughnessFactor": 0.22,
                },
            },
            {
                "name": "Mat_White",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.99, 0.99, 1.0, 1.0],
                    "metallicFactor": 0.02,
                    "roughnessFactor": 0.18,
                },
            },
            {
                "name": "Mat_Mouth",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.68, 0.22, 0.22, 1.0],
                    "metallicFactor": 0.02,
                    "roughnessFactor": 0.45,
                },
            },
        ],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "buffers": [{"byteLength": len(bin_blob)}],
    }

    json_bytes = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_len))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(bin_blob), 0x004E4942))
        f.write(bin_blob)

    print(
        f"Compiled {out_path}: {total_len} bytes, "
        f"{len(skins_gltf)} skin ({len(JOINT_BIND_WORLD)} joints), "
        f"{len(meshes_gltf)} SkinnedMeshes, {len(animations_gltf)} skeletal animations"
    )


if __name__ == "__main__":
    compile_customer_glb("public/models/customer_character.glb")
