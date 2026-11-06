#!/usr/bin/env python3
"""
BURGER DISTRICT — Professional 3D Industrial Kitchen & Grill Asset Compiler (v3.0)
Generates a spec-compliant binary glTF 2.0 (.glb) file at public/models/industrial_kitchen.glb
with:
- 512x512 embedded procedural PBR textures (BaseColor, Tangent-Space Normal, Occlusion-Roughness-Metallic)
- Explicit per-vertex TANGENT (VEC4) attributes for artifact-free tangent-space normal mapping
- Watertight non-overlapping rounded-box bevel geometry and ear-clipped concave profile end-caps
- Authentic V-profile cast-iron charbroiler grates, gas manifold & pilot sight holes, Ansul hood fire
  suppression nozzles, full bullnose left Gastronorm refrigerated prep counter with 4 chiller doors,
  and 3D recessed juice-groove end-grain butcher block aligned with STATIONS in RestaurantLayout.ts.
"""

import json
import math
import os
import struct
import zlib
from typing import List, Tuple

# ---------------------------------------------------------------------------
# 1. Pure-Python Spec-Compliant PNG Encoder for 512x512 Embedded PBR Textures
# ---------------------------------------------------------------------------

def encode_png_rgba(width: int, height: int, pixels: bytes) -> bytes:
    """Encode raw RGBA bytes (width * height * 4) into a valid PNG binary buffer."""
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


def hash_noise(x: int, y: int, seed: int = 1337) -> float:
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def build_stainless_pbr_textures(size: int = 512) -> Tuple[bytes, bytes, bytes]:
    """
    Returns 512x512 (baseColor_png, orm_png, normal_png) for commercial #4 satin-brushed
    304 stainless steel with directional linear micro-scratches, subtle panel edge AO,
    and realistic roughness micro-variation (no artificial low-frequency sine waves).
    """
    base = bytearray(size * size * 4)
    orm = bytearray(size * size * 4)
    norm = bytearray(size * size * 4)
    height_field = [[0.0] * size for _ in range(size)]

    for y in range(size):
        row_n1 = hash_noise(0, y, 17) - 0.5
        row_n2 = hash_noise(0, y // 2, 29) - 0.5
        row_grain = row_n1 * 0.028 + row_n2 * 0.018
        for x in range(size):
            # Multi-scale horizontal brush passes (long anisotropic strokes along X)
            stroke_long = (hash_noise(x // 32, y, 43) - 0.5) * 0.024
            stroke_med = (hash_noise(x // 12, y, 61) - 0.5) * 0.018
            micro = (hash_noise(x, y, 89) - 0.5) * 0.010
            h = 0.5 + row_grain + stroke_long + stroke_med + micro
            height_field[y][x] = h

            # Subtle peripheral sheet-metal edge darkening for natural panel depth
            edge_dist = min(x, size - 1 - x, y, size - 1 - y) / float(size)
            edge_ao = 0.92 + 0.08 * min(1.0, edge_dist * 14.0)

            albedo_val = (218.0 + (row_grain + stroke_long) * 34.0) * edge_ao
            idx = (y * size + x) * 4
            base[idx + 0] = clamp_u8(albedo_val * 0.985)
            base[idx + 1] = clamp_u8(albedo_val * 1.000)
            base[idx + 2] = clamp_u8(albedo_val * 1.025)
            base[idx + 3] = 255

            roughness = 0.22 - (row_grain + stroke_long) * 0.12 + abs(stroke_med) * 0.16
            metalness = 0.91

            orm[idx + 0] = clamp_u8(edge_ao * 255)
            orm[idx + 1] = clamp_u8(roughness * 255)
            orm[idx + 2] = clamp_u8(metalness * 255)
            orm[idx + 3] = 255

    strength = 0.72
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (height_field[y][xp] - height_field[y][xm]) * strength
            dy = (height_field[yp][x] - height_field[ym][x]) * strength
            inv_len = 1.0 / math.sqrt(dx * dx + dy * dy + 1.0)
            idx = (y * size + x) * 4
            norm[idx + 0] = clamp_u8((-dx * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 1] = clamp_u8((-dy * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 2] = clamp_u8((1.0 * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 3] = 255

    return (
        encode_png_rgba(size, size, bytes(base)),
        encode_png_rgba(size, size, bytes(orm)),
        encode_png_rgba(size, size, bytes(norm)),
    )


def build_cast_iron_pbr_textures(size: int = 512) -> Tuple[bytes, bytes, bytes]:
    """
    Returns 512x512 (baseColor_png, orm_png, normal_png) for seasoned heavy cast iron
    with multi-octave sand-cast cellular micro-pitting and heat-seasoned oil patina.
    """
    base = bytearray(size * size * 4)
    orm = bytearray(size * size * 4)
    norm = bytearray(size * size * 4)
    hmap = [[0.0] * size for _ in range(size)]

    for y in range(size):
        for x in range(size):
            coarse = (hash_noise(x // 4, y // 4, 101) - 0.5) * 0.12
            med = (hash_noise(x // 2, y // 2, 202) - 0.5) * 0.10
            fine = (hash_noise(x, y, 303) - 0.5) * 0.08
            pit = -0.14 if hash_noise(x, y, 409) < 0.06 else 0.0
            grain = coarse + med + fine + pit
            hmap[y][x] = grain

            idx = (y * size + x) * 4
            v = 38.0 + grain * 24.0
            base[idx + 0] = clamp_u8(v * 1.03)
            base[idx + 1] = clamp_u8(v * 1.00)
            base[idx + 2] = clamp_u8(v * 1.05)
            base[idx + 3] = 255

            ao = 0.86 if pit < 0 else 0.96
            rough = 0.38 - grain * 0.16 + (-0.08 if pit == 0 and grain > 0.06 else 0.04)
            orm[idx + 0] = clamp_u8(ao * 255)
            orm[idx + 1] = clamp_u8(rough * 255)
            orm[idx + 2] = clamp_u8(0.80 * 255)
            orm[idx + 3] = 255

    strength = 1.55
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (hmap[y][xp] - hmap[y][xm]) * strength
            dy = (hmap[yp][x] - hmap[ym][x]) * strength
            inv_len = 1.0 / math.sqrt(dx * dx + dy * dy + 1.0)
            idx = (y * size + x) * 4
            norm[idx + 0] = clamp_u8((-dx * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 1] = clamp_u8((-dy * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 2] = clamp_u8((1.0 * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 3] = 255

    return (
        encode_png_rgba(size, size, bytes(base)),
        encode_png_rgba(size, size, bytes(orm)),
        encode_png_rgba(size, size, bytes(norm)),
    )


def build_butcher_block_textures(size: int = 512) -> Tuple[bytes, bytes, bytes]:
    """
    Returns 512x512 (baseColor_png, orm_png, normal_png) for staggered end-grain/edge-grain
    oiled maple & walnut butcher block with realistic wood pore fibers and knife-score wear.
    """
    base = bytearray(size * size * 4)
    orm = bytearray(size * size * 4)
    norm = bytearray(size * size * 4)
    hmap = [[0.0] * size for _ in range(size)]

    row_h = 32
    col_w = 64
    for y in range(size):
        row_idx = y // row_h
        row_seam = (y % row_h == 0) or (y % row_h == row_h - 1)
        x_shift = (row_idx * 37) % col_w
        for x in range(size):
            xs = (x + x_shift) % size
            col_idx = xs // col_w
            col_seam = (xs % col_w == 0)
            block_seed = row_idx * 31 + col_idx * 17

            block_tint = (hash_noise(col_idx, row_idx, 501) - 0.5) * 0.14
            ring_wave = math.sin(
                (xs % col_w) * 0.22
                + (y % row_h) * 0.14
                + hash_noise(x // 6, y // 6, block_seed) * 2.2
            ) * 0.032
            fine_pore = (hash_noise(x, y, 613) - 0.5) * 0.018

            # Subtle knife-prep score marks near the center of the board
            cx_norm = (x - size * 0.5) / (size * 0.5)
            cy_norm = (y - size * 0.5) / (size * 0.5)
            center_weight = max(0.0, 1.0 - (cx_norm * cx_norm + cy_norm * cy_norm) * 1.4)
            knife_score = (
                -0.035 * center_weight
                if hash_noise(x // 2, y * 3, 727) < 0.045 * center_weight
                else 0.0
            )

            seam_dip = -0.065 if (row_seam or col_seam) else 0.0
            h = ring_wave + fine_pore + knife_score + seam_dip
            hmap[y][x] = h

            tone = 0.93 + block_tint + ring_wave + fine_pore + knife_score * 0.5
            if row_seam or col_seam:
                tone *= 0.82

            idx = (y * size + x) * 4
            base[idx + 0] = clamp_u8(222.0 * tone)
            base[idx + 1] = clamp_u8(164.0 * tone)
            base[idx + 2] = clamp_u8(102.0 * tone)
            base[idx + 3] = 255

            ao = 0.86 if (row_seam or col_seam) else 0.98
            rough = 0.30 - ring_wave * 0.10 + (-knife_score * 1.8)
            orm[idx + 0] = clamp_u8(ao * 255)
            orm[idx + 1] = clamp_u8(rough * 255)
            orm[idx + 2] = clamp_u8(0.04 * 255)
            orm[idx + 3] = 255

    strength = 1.05
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (hmap[y][xp] - hmap[y][xm]) * strength
            dy = (hmap[yp][x] - hmap[ym][x]) * strength
            inv_len = 1.0 / math.sqrt(dx * dx + dy * dy + 1.0)
            idx = (y * size + x) * 4
            norm[idx + 0] = clamp_u8((-dx * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 1] = clamp_u8((-dy * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 2] = clamp_u8((1.0 * inv_len * 0.5 + 0.5) * 255)
            norm[idx + 3] = 255

    return (
        encode_png_rgba(size, size, bytes(base)),
        encode_png_rgba(size, size, bytes(orm)),
        encode_png_rgba(size, size, bytes(norm)),
    )


# ---------------------------------------------------------------------------
# 2. Polygon Ear-Clipping Triangulator for Concave 2D Extrusion End-Caps
# ---------------------------------------------------------------------------

def triangulate_polygon_2d(pts: List[Tuple[float, float]]) -> List[Tuple[int, int, int]]:
    """
    Ear-clipping triangulation for arbitrary simple (convex or concave) 2D polygons.
    Eliminates concave centroid-fan bridging artifacts on L-shaped bullnose & range hood caps.
    """
    n = len(pts)
    if n < 3:
        return []

    # Compute signed area to determine winding order
    area2 = 0.0
    for i in range(n):
        y0, z0 = pts[i]
        y1, z1 = pts[(i + 1) % n]
        area2 += y0 * z1 - y1 * z0

    ccw = area2 >= 0.0
    indices = list(range(n))
    tris: List[Tuple[int, int, int]] = []

    def cross2(ay: float, az: float, by: float, bz: float, cy: float, cz: float) -> float:
        return (by - ay) * (cz - az) - (bz - az) * (cy - ay)

    def point_in_tri(
        py: float, pz: float,
        ay: float, az: float,
        by: float, bz: float,
        cy: float, cz: float,
    ) -> bool:
        c1 = cross2(ay, az, by, bz, py, pz)
        c2 = cross2(by, bz, cy, cz, py, pz)
        c3 = cross2(cy, cz, ay, az, py, pz)
        if ccw:
            return c1 >= -1e-7 and c2 >= -1e-7 and c3 >= -1e-7
        return c1 <= 1e-7 and c2 <= 1e-7 and c3 <= 1e-7

    guard = 0
    while len(indices) > 3 and guard < n * n + 16:
        guard += 1
        ear_found = False
        m = len(indices)
        for i in range(m):
            i_prev = indices[(i - 1) % m]
            i_curr = indices[i]
            i_next = indices[(i + 1) % m]
            ay, az = pts[i_prev]
            by, bz = pts[i_curr]
            cy, cz = pts[i_next]

            cr = cross2(ay, az, by, bz, cy, cz)
            if (ccw and cr <= 1e-7) or ((not ccw) and cr >= -1e-7):
                continue

            contains_other = False
            for j in indices:
                if j in (i_prev, i_curr, i_next):
                    continue
                py, pz = pts[j]
                if point_in_tri(py, pz, ay, az, by, bz, cy, cz):
                    contains_other = True
                    break

            if not contains_other:
                tris.append((i_prev, i_curr, i_next))
                del indices[i]
                ear_found = True
                break

        if not ear_found:
            # Fallback clip if nearly collinear
            tris.append((indices[0], indices[1], indices[2]))
            del indices[1]

    if len(indices) == 3:
        tris.append((indices[0], indices[1], indices[2]))

    return tris


# ---------------------------------------------------------------------------
# 3. High-Detail Watertight Beveled Mesh Builder with Analytic Tangents
# ---------------------------------------------------------------------------

class MeshBuilder:
    def __init__(self, name: str, material_index: int):
        self.name = name
        self.material_index = material_index
        self.positions: List[Tuple[float, float, float]] = []
        self.normals: List[Tuple[float, float, float]] = []
        self.tangents: List[Tuple[float, float, float, float]] = []
        self.uvs: List[Tuple[float, float]] = []
        self.indices: List[int] = []

    def add_vertex(
        self,
        pos: Tuple[float, float, float],
        norm: Tuple[float, float, float],
        uv: Tuple[float, float],
        tan: Tuple[float, float, float] = None,
    ) -> int:
        idx = len(self.positions)
        self.positions.append(pos)
        nx, ny, nz = norm
        l = math.sqrt(nx * nx + ny * ny + nz * nz)
        if l > 1e-8:
            nx, ny, nz = nx / l, ny / l, nz / l
        else:
            nx, ny, nz = 0.0, 1.0, 0.0
        self.normals.append((nx, ny, nz))

        # Compute orthogonal unit tangent vector (tx, ty, tz, +1.0)
        if tan is not None:
            tx, ty, tz = tan
        else:
            # Default tangent aligned with world X (or Z when normal is parallel to X)
            if abs(nx) < 0.9:
                tx, ty, tz = 1.0, 0.0, 0.0
            else:
                tx, ty, tz = 0.0, 0.0, 1.0
        # Gram-Schmidt orthogonalize tangent against normal
        dot = tx * nx + ty * ny + tz * nz
        tx -= dot * nx
        ty -= dot * ny
        tz -= dot * nz
        tl = math.sqrt(tx * tx + ty * ty + tz * tz)
        if tl > 1e-8:
            tx, ty, tz = tx / tl, ty / tl, tz / tl
        else:
            tx, ty, tz = 1.0, 0.0, 0.0
        self.tangents.append((tx, ty, tz, 1.0))

        self.uvs.append(uv)
        return idx

    def add_tri_checked(self, i0: int, i1: int, i2: int) -> None:
        """Append triangle indices, automatically orienting winding to match outward vertex normals."""
        p0 = self.positions[i0]
        p1 = self.positions[i1]
        p2 = self.positions[i2]
        ux, uy, uz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
        vx, vy, vz = p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]
        cx = uy * vz - uz * vy
        cy = uz * vx - ux * vz
        cz = ux * vy - uy * vx
        n0 = self.normals[i0]
        n1 = self.normals[i1]
        n2 = self.normals[i2]
        nx = n0[0] + n1[0] + n2[0]
        ny = n0[1] + n1[1] + n2[1]
        nz = n0[2] + n1[2] + n2[2]
        if cx * nx + cy * ny + cz * nz < 0.0:
            self.indices.extend([i0, i2, i1])
        else:
            self.indices.extend([i0, i1, i2])

    def add_quad(self, i0: int, i1: int, i2: int, i3: int) -> None:
        self.add_tri_checked(i0, i1, i2)
        self.add_tri_checked(i0, i2, i3)

    def add_beveled_box(
        self,
        cx: float,
        cy: float,
        cz: float,
        sx: float,
        sy: float,
        sz: float,
        bevel: float = 0.015,
        segs: int = 2,
        rx: float = 0.0,
        ry: float = 0.0,
        rz: float = 0.0,
    ) -> None:
        """
        Watertight, single-manifold ring-lofted rounded box.
        Lofts closed XZ rounded-rectangle perimeter rings along the Y bevel profile
        and caps the top and bottom flat faces with zero corner gaps and zero overlap.
        """
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        bxz = min(bevel, hx * 0.42, hz * 0.42)
        by = min(bevel, hy * 0.42)
        ix, iy, iz = hx - bxz, hy - by, hz - bxz

        cx_cos, cx_sin = math.cos(rx), math.sin(rx)
        cy_cos, cy_sin = math.cos(ry), math.sin(ry)
        cz_cos, cz_sin = math.cos(rz), math.sin(rz)

        def rot_vec(vx: float, vy: float, vz: float) -> Tuple[float, float, float]:
            x1 = vx * cz_cos - vy * cz_sin
            y1 = vx * cz_sin + vy * cz_cos
            z1 = vz
            x2 = x1
            y2 = y1 * cx_cos - z1 * cx_sin
            z2 = y1 * cx_sin + z1 * cx_cos
            x3 = x2 * cy_cos + z2 * cy_sin
            y3 = y2
            z3 = -x2 * cy_sin + z2 * cy_cos
            return (x3, y3, z3)

        n_c = max(1, segs)
        # Build 2D XZ perimeter loop (4 quarter-circle corners in CCW order when viewed from +Y)
        xz_loop: List[Tuple[float, float, float, float, float]] = []
        corners = [
            (ix, iz, 0.0, math.pi * 0.5),
            (-ix, iz, math.pi * 0.5, math.pi),
            (-ix, -iz, math.pi, math.pi * 1.5),
            (ix, -iz, math.pi * 1.5, math.pi * 2.0),
        ]
        arc_s = 0.0
        prev_px, prev_pz = None, None
        for (ccx, ccz, a0, a1) in corners:
            for s_i in range(n_c + 1):
                ang = a0 + (s_i / n_c) * (a1 - a0)
                cn, sn = math.cos(ang), math.sin(ang)
                px, pz = ccx + cn * bxz, ccz + sn * bxz
                if prev_px is not None:
                    arc_s += math.hypot(px - prev_px, pz - prev_pz)
                prev_px, prev_pz = px, pz
                xz_loop.append(( ccx, ccz, cn, sn, arc_s ))
        # Close loop seam with exact first corner point
        ccx0, ccz0, cn0, sn0, _ = xz_loop[0]
        px0, pz0 = ccx0 + cn0 * bxz, ccz0 + sn0 * bxz
        arc_s += math.hypot(px0 - prev_px, pz0 - prev_pz)
        xz_loop.append((ccx0, ccz0, cn0, sn0, arc_s))

        # Build Y profile levels from bottom (-hy) to top (+hy)
        y_levels: List[Tuple[float, float, float]] = []
        for i in range(n_c + 1):
            phi = -math.pi * 0.5 + (i / n_c) * (math.pi * 0.5)
            y_levels.append((-iy + math.sin(phi) * by, math.cos(phi), math.sin(phi)))
        for i in range(n_c + 1):
            phi = (i / n_c) * (math.pi * 0.5)
            y_levels.append((iy + math.sin(phi) * by, math.cos(phi), math.sin(phi)))

        uv_scale = 0.85
        rings: List[List[int]] = []
        for (vy, r_scale, ny_comp) in y_levels:
            ring_idxs: List[int] = []
            for (ccx, ccz, cn, sn, s_val) in xz_loop:
                vx = ccx + cn * bxz * r_scale
                vz = ccz + sn * bxz * r_scale
                nx = cn * r_scale
                nz = sn * r_scale
                ny = ny_comp
                tx, ty, tz = -sn, 0.0, cn
                rx_p, ry_p, rz_p = rot_vec(vx, vy, vz)
                rx_n, ry_n, rz_n = rot_vec(nx, ny, nz)
                rx_t, ry_t, rz_t = rot_vec(tx, ty, tz)
                ring_idxs.append(
                    self.add_vertex(
                        (cx + rx_p, cy + ry_p, cz + rz_p),
                        (rx_n, ry_n, rz_n),
                        (s_val * uv_scale, (vy + hy) * uv_scale),
                        (rx_t, ry_t, rz_t),
                    )
                )
            rings.append(ring_idxs)

        n_loop = len(xz_loop) - 1
        for r_i in range(len(rings) - 1):
            for s_i in range(n_loop):
                self.add_quad(
                    rings[r_i][s_i],
                    rings[r_i][s_i + 1],
                    rings[r_i + 1][s_i + 1],
                    rings[r_i + 1][s_i],
                )

        # Cap bottom (y = -hy, ring 0) and top (y = +hy, ring -1) cleanly to center vertex
        for y_val, ny_sign in ((-hy, -1.0), (hy, 1.0)):
            rx_n, ry_n, rz_n = rot_vec(0.0, ny_sign, 0.0)
            rx_t, ry_t, rz_t = rot_vec(1.0, 0.0, 0.0)
            rx_c, ry_c, rz_c = rot_vec(0.0, y_val, 0.0)
            center_idx = self.add_vertex(
                (cx + rx_c, cy + ry_c, cz + rz_c),
                (rx_n, ry_n, rz_n),
                (hx * uv_scale, hz * uv_scale),
                (rx_t, ry_t, rz_t),
            )
            cap_ring: List[int] = []
            for (ccx, ccz, _, _, _) in xz_loop:
                rx_p, ry_p, rz_p = rot_vec(ccx, y_val, ccz)
                cap_ring.append(
                    self.add_vertex(
                        (cx + rx_p, cy + ry_p, cz + rz_p),
                        (rx_n, ry_n, rz_n),
                        ((ccx + hx) * uv_scale, (ccz + hz) * uv_scale),
                        (rx_t, ry_t, rz_t),
                    )
                )
            for s_i in range(n_loop):
                self.add_tri_checked(center_idx, cap_ring[s_i], cap_ring[s_i + 1])

    def add_extruded_profile_x(
        self,
        x_min: float,
        x_max: float,
        profile_yz: List[Tuple[float, float]],
        closed: bool = True,
    ) -> None:
        """Extrude a 2D (Y, Z) profile along X with smooth fillet normals and ear-clipped end caps."""
        n_pts = len(profile_yz)
        if n_pts < 2:
            return

        seg_normals: List[Tuple[float, float]] = []
        seg_count = n_pts if closed else n_pts - 1
        for i in range(seg_count):
            y0, z0 = profile_yz[i]
            y1, z1 = profile_yz[(i + 1) % n_pts]
            dy = y1 - y0
            dz = z1 - z0
            l = math.hypot(dy, dz)
            if l < 1e-8:
                seg_normals.append((1.0, 0.0))
            else:
                seg_normals.append((dz / l, -dy / l))

        vert_normals: List[Tuple[float, float]] = []
        for i in range(n_pts):
            if not closed and (i == 0 or i == n_pts - 1):
                sn = seg_normals[0] if i == 0 else seg_normals[-1]
                vert_normals.append(sn)
            else:
                n_prev = seg_normals[(i - 1) % seg_count]
                n_curr = seg_normals[i % seg_count]
                dot = n_prev[0] * n_curr[0] + n_prev[1] * n_curr[1]
                if dot > 0.68:
                    ny = n_prev[0] + n_curr[0]
                    nz = n_prev[1] + n_curr[1]
                    l = math.hypot(ny, nz) or 1.0
                    vert_normals.append((ny / l, nz / l))
                else:
                    vert_normals.append(n_curr)

        arc_len = 0.0
        span_x = max(0.05, x_max - x_min)
        for i in range(seg_count):
            y0, z0 = profile_yz[i]
            y1, z1 = profile_yz[(i + 1) % n_pts]
            seg_len = math.hypot(y1 - y0, z1 - z0)
            sn = seg_normals[i]
            n_prev = seg_normals[(i - 1) % seg_count]
            n_next = seg_normals[(i + 1) % seg_count]

            n0 = vert_normals[i]
            n1 = vert_normals[(i + 1) % n_pts] if (n_next[0] * sn[0] + n_next[1] * sn[1]) > 0.68 else sn
            if (n_prev[0] * sn[0] + n_prev[1] * sn[1]) <= 0.68:
                n0 = sn

            u0, u1 = 0.0, span_x * 0.75
            v0, v1 = arc_len * 0.85, (arc_len + seg_len) * 0.85
            arc_len += seg_len

            idx0 = self.add_vertex((x_min, y0, z0), (0.0, n0[0], n0[1]), (u0, v0), (1.0, 0.0, 0.0))
            idx1 = self.add_vertex((x_max, y0, z0), (0.0, n0[0], n0[1]), (u1, v0), (1.0, 0.0, 0.0))
            idx2 = self.add_vertex((x_max, y1, z1), (0.0, n1[0], n1[1]), (u1, v1), (1.0, 0.0, 0.0))
            idx3 = self.add_vertex((x_min, y1, z1), (0.0, n1[0], n1[1]), (u0, v1), (1.0, 0.0, 0.0))
            self.add_quad(idx0, idx1, idx2, idx3)

        if closed and n_pts >= 3:
            cap_tris = triangulate_polygon_2d(profile_yz)
            min_y = min(p[0] for p in profile_yz)
            min_z = min(p[1] for p in profile_yz)
            for x_pos, nx_sign in ((x_min, -1.0), (x_max, 1.0)):
                ring = [
                    self.add_vertex(
                        (x_pos, py, pz),
                        (nx_sign, 0.0, 0.0),
                        ((pz - min_z) * 0.85, (py - min_y) * 0.85),
                        (0.0, 0.0, 1.0),
                    )
                    for (py, pz) in profile_yz
                ]
                for (i0, i1, i2) in cap_tris:
                    self.add_tri_checked(ring[i0], ring[i1], ring[i2])

    def add_extruded_profile_z(
        self,
        z_min: float,
        z_max: float,
        profile_xy: List[Tuple[float, float]],
        closed: bool = True,
    ) -> None:
        """Extrude a 2D (X, Y) profile along Z with smooth fillet normals and ear-clipped end caps."""
        n_pts = len(profile_xy)
        if n_pts < 2:
            return

        seg_normals: List[Tuple[float, float]] = []
        seg_count = n_pts if closed else n_pts - 1
        for i in range(seg_count):
            x0, y0 = profile_xy[i]
            x1, y1 = profile_xy[(i + 1) % n_pts]
            dx = x1 - x0
            dy = y1 - y0
            l = math.hypot(dx, dy)
            if l < 1e-8:
                seg_normals.append((0.0, 1.0))
            else:
                seg_normals.append((-dy / l, dx / l))

        vert_normals: List[Tuple[float, float]] = []
        for i in range(n_pts):
            if not closed and (i == 0 or i == n_pts - 1):
                sn = seg_normals[0] if i == 0 else seg_normals[-1]
                vert_normals.append(sn)
            else:
                n_prev = seg_normals[(i - 1) % seg_count]
                n_curr = seg_normals[i % seg_count]
                dot = n_prev[0] * n_curr[0] + n_prev[1] * n_curr[1]
                if dot > 0.68:
                    nx = n_prev[0] + n_curr[0]
                    ny = n_prev[1] + n_curr[1]
                    l = math.hypot(nx, ny) or 1.0
                    vert_normals.append((nx / l, ny / l))
                else:
                    vert_normals.append(n_curr)

        arc_len = 0.0
        span_z = max(0.05, z_max - z_min)
        for i in range(seg_count):
            x0, y0 = profile_xy[i]
            x1, y1 = profile_xy[(i + 1) % n_pts]
            seg_len = math.hypot(x1 - x0, y1 - y0)
            sn = seg_normals[i]
            n_prev = seg_normals[(i - 1) % seg_count]
            n_next = seg_normals[(i + 1) % seg_count]

            n0 = vert_normals[i]
            n1 = vert_normals[(i + 1) % n_pts] if (n_next[0] * sn[0] + n_next[1] * sn[1]) > 0.68 else sn
            if (n_prev[0] * sn[0] + n_prev[1] * sn[1]) <= 0.68:
                n0 = sn

            u0, u1 = 0.0, span_z * 0.75
            v0, v1 = arc_len * 0.85, (arc_len + seg_len) * 0.85
            arc_len += seg_len

            idx0 = self.add_vertex((x0, y0, z_min), (n0[0], n0[1], 0.0), (u0, v0), (0.0, 0.0, 1.0))
            idx1 = self.add_vertex((x0, y0, z_max), (n0[0], n0[1], 0.0), (u1, v0), (0.0, 0.0, 1.0))
            idx2 = self.add_vertex((x1, y1, z_max), (n1[0], n1[1], 0.0), (u1, v1), (0.0, 0.0, 1.0))
            idx3 = self.add_vertex((x1, y1, z_min), (n1[0], n1[1], 0.0), (u0, v1), (0.0, 0.0, 1.0))
            self.add_quad(idx0, idx1, idx2, idx3)

        if closed and n_pts >= 3:
            cap_tris = triangulate_polygon_2d(profile_xy)
            min_x = min(p[0] for p in profile_xy)
            min_y = min(p[1] for p in profile_xy)
            for z_pos, nz_sign in ((z_min, -1.0), (z_max, 1.0)):
                ring = [
                    self.add_vertex(
                        (px, py, z_pos),
                        (0.0, 0.0, nz_sign),
                        ((px - min_x) * 0.85, (py - min_y) * 0.85),
                        (1.0, 0.0, 0.0),
                    )
                    for (px, py) in profile_xy
                ]
                for (i0, i1, i2) in cap_tris:
                    self.add_tri_checked(ring[i0], ring[i1], ring[i2])

    def add_lathe_cylinder(
        self,
        cx: float,
        cy: float,
        cz: float,
        profile_ry: List[Tuple[float, float]],
        radial_segs: int = 16,
        axis: str = "y",
    ) -> None:
        rings: List[List[int]] = []
        n_pts = len(profile_ry)
        for p_idx in range(n_pts):
            r, h = profile_ry[p_idx]
            r_prev, h_prev = profile_ry[max(0, p_idx - 1)]
            r_next, h_next = profile_ry[min(n_pts - 1, p_idx + 1)]
            dr = r_next - r_prev
            dh = h_next - h_prev
            tl = math.hypot(dr, dh) or 1.0
            nr_comp = dh / tl
            nh_comp = -dr / tl

            ring = []
            for s in range(radial_segs + 1):
                theta = (s / radial_segs) * math.pi * 2.0
                c_t, s_t = math.cos(theta), math.sin(theta)
                if axis == "y":
                    px, py, pz = cx + r * c_t, cy + h, cz + r * s_t
                    nx, ny, nz = nr_comp * c_t, nh_comp, nr_comp * s_t
                    tx, ty, tz = -s_t, 0.0, c_t
                elif axis == "z":
                    px, py, pz = cx + r * c_t, cy + r * s_t, cz + h
                    nx, ny, nz = nr_comp * c_t, nr_comp * s_t, nh_comp
                    tx, ty, tz = -s_t, c_t, 0.0
                else:
                    px, py, pz = cx + h, cy + r * c_t, cz + r * s_t
                    nx, ny, nz = nh_comp, nr_comp * c_t, nr_comp * s_t
                    tx, ty, tz = 0.0, -s_t, c_t
                ring.append(
                    self.add_vertex(
                        (px, py, pz),
                        (nx, ny, nz),
                        (s / radial_segs, p_idx / max(1, n_pts - 1)),
                        (tx, ty, tz),
                    )
                )
            rings.append(ring)

        for p_idx in range(n_pts - 1):
            for s in range(radial_segs):
                i0 = rings[p_idx][s]
                i1 = rings[p_idx][s + 1]
                i2 = rings[p_idx + 1][s + 1]
                i3 = rings[p_idx + 1][s]
                self.add_quad(i0, i3, i2, i1)


# ---------------------------------------------------------------------------
# 4. Assemble Complete Commercial Kitchen, Charbroiler Grill & Range Hood Scene
# ---------------------------------------------------------------------------

def build_industrial_kitchen_meshes() -> List[MeshBuilder]:
    steel = MeshBuilder("KitchenStainlessSteel", material_index=0)
    iron = MeshBuilder("KitchenCastIron", material_index=1)
    ember = MeshBuilder("KitchenBurnerEmbers", material_index=2)
    wood = MeshBuilder("KitchenButcherBlock", material_index=3)
    hood_light = MeshBuilder("KitchenHoodTaskLights", material_index=4)

    # =========================================================================
    # A. MAIN BACK COMMERCIAL COUNTER & CHILLER LINE (X: -6.52 to 3.55, Z: -5.68 to -4.58)
    #    Top surface at Y = 0.915 so grill & butcher block sit flush above it
    # =========================================================================
    bullnose_profile = [
        (0.850, -4.595),
        (0.850, -4.570),
        (0.862, -4.555),
        (0.882, -4.548),
        (0.902, -4.555),
        (0.912, -4.570),
        (0.915, -4.595),
        (0.915, -5.620),  # Flat stainless worktop
        (0.922, -5.645),  # Coved rear fillet curve
        (0.940, -5.660),
        (1.065, -5.660),  # Rear coved backsplash upstand top
        (1.065, -5.690),
        (0.850, -5.690),
    ]
    steel.add_extruded_profile_x(-6.52, 3.55, bullnose_profile, closed=True)

    # Recessed Dark Iron Toe-Kick Plinth & Adjustable Cylindrical Stainless Legs
    iron.add_beveled_box(-1.48, 0.075, -5.16, 10.0, 0.15, 0.92, bevel=0.01, segs=1)
    for lx in [-6.25, -4.4, -2.6, -0.8, 1.0, 3.25]:
        for lz in [-5.52, -4.68]:
            steel.add_lathe_cylinder(
                lx, 0.0, lz,
                [(0.036, 0.0), (0.036, 0.015), (0.022, 0.02), (0.022, 0.15)],
                radial_segs=12, axis="y"
            )

    # Main Stainless Cabinet Body Carcass (X: -6.50 to 3.52, Y: 0.15 to 0.85, Z: -5.68 to -4.62)
    steel.add_beveled_box(-1.49, 0.50, -5.15, 10.02, 0.70, 1.04, bevel=0.022, segs=2)

    # Left Compressor Service Bay with 9 Angled 3D Louvers & Digital Chiller Thermostat
    iron.add_beveled_box(-5.92, 0.49, -4.62, 0.88, 0.56, 0.04, bevel=0.008, segs=1)
    for lv_i in range(9):
        ly = 0.27 + lv_i * 0.045
        steel.add_beveled_box(-5.92, ly, -4.60, 0.78, 0.018, 0.035, bevel=0.004, segs=1, rx=0.38)
    iron.add_beveled_box(-5.92, 0.72, -4.605, 0.24, 0.072, 0.03, bevel=0.005, segs=1)
    ember.add_beveled_box(-5.92, 0.72, -4.59, 0.15, 0.040, 0.015, bevel=0.003, segs=1)

    # Eight Commercial Beveled Stainless Chiller Doors with EPDM Gaskets, Hinges & Tubular Pull Handles
    door_centers_x = [-4.82, -3.76, -2.70, -1.64, -0.58, 0.48, 1.54, 2.60]
    for d_idx, dx in enumerate(door_centers_x):
        iron.add_beveled_box(dx, 0.49, -4.622, 0.94, 0.58, 0.025, bevel=0.006, segs=1)
        steel.add_beveled_box(dx, 0.49, -4.604, 0.90, 0.54, 0.036, bevel=0.015, segs=2)
        hx = dx + (0.33 if d_idx % 2 == 0 else -0.33)
        hinge_x = dx + (-0.43 if d_idx % 2 == 0 else 0.43)
        iron.add_beveled_box(hx, 0.53, -4.586, 0.065, 0.26, 0.015, bevel=0.004, segs=1)
        steel.add_lathe_cylinder(hx, 0.40, -4.562, [(0.011, 0.0), (0.011, 0.26)], radial_segs=10, axis="y")
        steel.add_lathe_cylinder(hx, 0.63, -4.59, [(0.010, 0.0), (0.010, 0.032)], radial_segs=8, axis="z")
        steel.add_lathe_cylinder(hx, 0.42, -4.59, [(0.010, 0.0), (0.010, 0.032)], radial_segs=8, axis="z")
        # Heavy commercial door hinges on opposite side of handle
        steel.add_beveled_box(hinge_x, 0.68, -4.59, 0.028, 0.048, 0.022, bevel=0.004, segs=1)
        steel.add_beveled_box(hinge_x, 0.30, -4.59, 0.028, 0.048, 0.022, bevel=0.004, segs=1)

    # =========================================================================
    # B. PROFESSIONAL COMMERCIAL GAS CHARBROILER & PLANCHA GRIDDLE
    #    Centered over STATIONS.grill.slots (X: -2.80, Y: 0.915..0.978, Z: -5.20)
    #    Grate top is at Y = 0.978 so burger patties at Y = 0.982 sit directly on the bars!
    # =========================================================================
    gx = -2.80
    gz = -5.20

    # 1. Heavy Stainless Outer Chassis Frame with Beveled Corners
    steel.add_beveled_box(gx - 0.70, 0.950, gz, 0.08, 0.072, 0.86, bevel=0.014, segs=2)
    steel.add_beveled_box(gx + 0.70, 0.950, gz, 0.08, 0.072, 0.86, bevel=0.014, segs=2)
    steel.add_beveled_box(gx, 0.950, gz - 0.39, 1.48, 0.072, 0.09, bevel=0.014, segs=2)
    steel.add_beveled_box(gx, 0.950, gz + 0.39, 1.48, 0.072, 0.09, bevel=0.014, segs=2)

    # Dark Recessed Firebox Floor at Y = 0.925
    iron.add_beveled_box(gx, 0.925, gz, 1.34, 0.02, 0.74, bevel=0.005, segs=1)

    # 2. Sloped Front Stainless Control Manifold & Grease Trough Channel
    manifold_profile = [
        (0.915, -4.76),
        (0.915, -4.60),
        (0.935, -4.57),
        (0.978, -4.61),
        (0.990, -4.66),
        (0.972, -4.76),
    ]
    steel.add_extruded_profile_x(gx - 0.74, gx + 0.74, manifold_profile, closed=True)

    # Dark Anodized Control Faceplate Strip + Gas Supply Pipe Manifold & Shutoff Valve
    iron.add_beveled_box(gx, 0.956, -4.592, 1.36, 0.048, 0.016, bevel=0.004, segs=1, rx=-0.35)
    iron.add_lathe_cylinder(gx - 0.72, 0.922, -4.60, [(0.012, 0.0), (0.012, 1.44)], radial_segs=10, axis="x")
    ember.add_beveled_box(gx + 0.64, 0.922, -4.575, 0.042, 0.018, 0.028, bevel=0.004, segs=1)

    # Front Grease Trough Gutter, Drain Chute & Removable Grease Catch Pan
    steel.add_beveled_box(gx, 0.962, -4.80, 1.34, 0.022, 0.068, bevel=0.006, segs=2)
    iron.add_beveled_box(gx, 0.970, -4.80, 1.26, 0.010, 0.042, bevel=0.003, segs=1)
    steel.add_beveled_box(gx - 0.46, 0.902, -4.58, 0.36, 0.040, 0.04, bevel=0.006, segs=2)
    steel.add_lathe_cylinder(gx - 0.46, 0.902, -4.55, [(0.007, -0.07), (0.007, 0.07)], radial_segs=8, axis="x")

    # 3. Chef's Front Bullnose Plating & Towel Rail mounted on standoffs
    steel.add_lathe_cylinder(gx - 0.72, 0.945, -4.50, [(0.013, 0.0), (0.013, 1.44)], radial_segs=12, axis="x")
    for s_off in (-0.58, 0.0, 0.58):
        steel.add_lathe_cylinder(gx + s_off, 0.945, -4.58, [(0.010, 0.0), (0.010, 0.08)], radial_segs=8, axis="z")

    # 4. Four Commercial Thermostat Dials with Chrome Bezels, Grips, Pointer, Pilot Holes & LEDs
    for kx in [gx - 0.48, gx - 0.16, gx + 0.16, gx + 0.48]:
        steel.add_lathe_cylinder(kx, 0.955, -4.585, [(0.032, 0.0), (0.030, 0.012), (0.0, 0.012)], radial_segs=14, axis="z")
        iron.add_lathe_cylinder(
            kx, 0.955, -4.575,
            [(0.025, 0.0), (0.027, 0.008), (0.024, 0.026), (0.019, 0.032), (0.0, 0.032)],
            radial_segs=14, axis="z"
        )
        ember.add_beveled_box(kx, 0.972, -4.560, 0.006, 0.018, 0.024, bevel=0.002, segs=1)
        ember.add_lathe_cylinder(kx + 0.048, 0.964, -4.585, [(0.006, 0.0), (0.006, 0.012), (0.0, 0.014)], radial_segs=8, axis="z")
        # Pilot flame sight hole bezel
        iron.add_lathe_cylinder(kx - 0.046, 0.944, -4.586, [(0.008, 0.0), (0.008, 0.010), (0.0, 0.010)], radial_segs=8, axis="z")

    # 5. Four Glowing Ceramic Infrared Burner Tubes & Angled Heat Tents inside Firebox (Y = 0.942..0.956)
    tent_profile = [
        (-0.032, 0.948),
        (0.0, 0.960),
        (0.032, 0.948),
        (0.024, 0.945),
        (0.0, 0.955),
        (-0.024, 0.945),
    ]
    for bx in [gx - 0.51, gx - 0.17, gx + 0.17, gx + 0.51]:
        ember.add_beveled_box(bx, 0.940, gz, 0.075, 0.014, 0.64, bevel=0.004, segs=1)
        shifted_tent = [(bx + px, py) for (px, py) in tent_profile]
        iron.add_extruded_profile_z(gz - 0.33, gz + 0.33, shifted_tent, closed=True)

    # 6. Authentic V-Profile Tapered Cast-Iron Charbroiler Grates (24 Bars + 3 Cross-Ribs)
    #    Top ridge sits at Y = 0.978 directly underneath STATIONS.grill.slots (Y = 0.982)
    for cross_z in (-5.48, -5.20, -4.92):
        iron.add_beveled_box(gx, 0.963, cross_z, 1.32, 0.012, 0.024, bevel=0.003, segs=1)

    num_bars = 24
    for b_i in range(num_bars):
        bx = (gx - 0.63) + (b_i / (num_bars - 1)) * 1.26
        grate_v_profile = [
            (bx - 0.012, 0.963),
            (bx + 0.012, 0.963),
            (bx + 0.008, 0.975),
            (bx + 0.003, 0.978),
            (bx - 0.003, 0.978),
            (bx - 0.008, 0.975),
        ]
        iron.add_extruded_profile_z(gz - 0.34, gz + 0.34, grate_v_profile, closed=True)

    # Center zone stainless divider rib between left and right dual-burner grates
    steel.add_beveled_box(gx, 0.973, gz, 0.026, 0.018, 0.70, bevel=0.005, segs=2)

    # 7. Tapered 3-Sided High Stainless Splash Guard with Rolled Safety Top Rim & Flue Vent
    steel.add_beveled_box(gx, 1.14, gz - 0.41, 1.48, 0.32, 0.046, bevel=0.014, segs=2)
    steel.add_beveled_box(gx, 1.305, gz - 0.395, 1.48, 0.028, 0.075, bevel=0.008, segs=2, rx=0.35)
    iron.add_beveled_box(gx, 1.285, gz - 0.382, 1.36, 0.018, 0.03, bevel=0.004, segs=1)

    side_wing_profile = [
        (0.975, -4.77),
        (1.06, -4.77),
        (1.29, gz - 0.39),
        (1.29, gz - 0.43),
        (0.975, gz - 0.43),
    ]
    steel.add_extruded_profile_x(gx - 0.74, gx - 0.695, side_wing_profile, closed=True)
    steel.add_extruded_profile_x(gx + 0.695, gx + 0.74, side_wing_profile, closed=True)

    # =========================================================================
    # C. COMMERCIAL EXHAUST RANGE HOOD CANOPY (Davlumbaz)
    #    Centered over Grill at X: -2.80, Y: 2.30..2.90, Z: -5.12
    # =========================================================================
    hood_outer_profile = [
        (2.30, -5.69),
        (2.30, -5.58),
        (2.64, -5.50),
        (2.64, -4.64),
        (2.30, -4.58),
        (2.30, -4.50),
        (2.46, -4.50),
        (2.88, -4.84),
        (2.88, -5.69),
        (2.30, -5.69),
    ]
    steel.add_extruded_profile_x(gx - 0.92, gx + 0.92, hood_outer_profile, closed=False)

    hood_side_wall = [
        (2.30, -5.69),
        (2.30, -4.50),
        (2.46, -4.50),
        (2.88, -4.84),
        (2.88, -5.69),
    ]
    steel.add_extruded_profile_x(gx - 0.94, gx - 0.89, hood_side_wall, closed=True)
    steel.add_extruded_profile_x(gx + 0.89, gx + 0.94, hood_side_wall, closed=True)

    # Perimeter Grease Drip Rim & Filter Mounting Tracks
    iron.add_beveled_box(gx, 2.305, -4.53, 1.89, 0.035, 0.07, bevel=0.006, segs=2)
    iron.add_beveled_box(gx - 0.915, 2.305, -5.10, 0.06, 0.035, 1.20, bevel=0.006, segs=2)
    iron.add_beveled_box(gx + 0.915, 2.305, -5.10, 0.06, 0.035, 1.20, bevel=0.006, segs=2)
    steel.add_beveled_box(gx, 2.34, -5.54, 1.78, 0.045, 0.055, bevel=0.006, segs=1)
    steel.add_beveled_box(gx, 2.61, -5.16, 1.78, 0.035, 0.045, bevel=0.005, segs=1)

    # 5 Angled Corrugated V-Bank Stainless Baffle Grease Filters with Grab Handles
    for f_i in range(5):
        fx = (gx - 0.68) + f_i * 0.34
        iron.add_beveled_box(fx, 2.48, -5.36, 0.31, 0.028, 0.44, bevel=0.004, segs=1, rx=0.58)
        for r_i in range(-2, 3):
            steel.add_beveled_box(fx + r_i * 0.052, 2.475, -5.35, 0.032, 0.034, 0.40, bevel=0.004, segs=1, rx=0.58)
        steel.add_beveled_box(fx, 2.41, -5.24, 0.09, 0.018, 0.03, bevel=0.004, segs=1, rx=0.58)

    # Twin Recessed Warm Halogen/LED Glass Task Light Lenses
    for lx in (gx - 0.42, gx + 0.42):
        iron.add_beveled_box(lx, 2.62, -4.82, 0.38, 0.04, 0.14, bevel=0.006, segs=1)
        hood_light.add_beveled_box(lx, 2.602, -4.82, 0.32, 0.025, 0.095, bevel=0.005, segs=1)

    # Ansul Fire-Suppression Manifold Pipe & Dual Aimed Nozzles inside Range Hood
    steel.add_lathe_cylinder(gx - 0.78, 2.24, -4.96, [(0.009, 0.0), (0.009, 1.56)], radial_segs=8, axis="x")
    for nx in (gx - 0.38, gx + 0.38):
        steel.add_lathe_cylinder(nx, 2.13, -4.96, [(0.007, 0.0), (0.007, 0.11)], radial_segs=8, axis="y")
        iron.add_lathe_cylinder(nx, 2.09, -4.96, [(0.016, 0.0), (0.008, 0.04)], radial_segs=10, axis="y")

    # Exhaust Riser Duct & Ceiling Suspension Hanger Rods
    steel.add_beveled_box(gx, 3.30, -5.28, 0.72, 0.94, 0.56, bevel=0.018, segs=2)
    iron.add_beveled_box(gx, 2.89, -5.28, 0.78, 0.045, 0.62, bevel=0.008, segs=2)
    for rx_h in (gx - 0.86, gx + 0.86):
        steel.add_lathe_cylinder(rx_h, 2.86, -4.88, [(0.012, 0.0), (0.012, 0.94)], radial_segs=8, axis="y")

    # =========================================================================
    # D. 3D RECESSED JUICE-GROOVE END-GRAIN BUTCHER BLOCK ASSEMBLY STATION
    #    Centered at STATIONS.assemblyBoard.position (X: 0.0, Y: 0.915..0.975, Z: -5.10)
    # =========================================================================
    # Non-slip dark rubber base cradle with stainless corner feet
    iron.add_beveled_box(0.0, 0.922, -5.10, 1.20, 0.018, 0.70, bevel=0.006, segs=1)
    # Lower solid maple base slab (creates the floor of the 3D recessed juice groove)
    wood.add_beveled_box(0.0, 0.942, -5.10, 1.16, 0.032, 0.66, bevel=0.012, segs=2)
    # Raised inner cutting plateau (Y top = 0.974) + 4 raised perimeter rim rails leaving a 3D juice groove channel
    wood.add_beveled_box(0.0, 0.964, -5.10, 1.00, 0.020, 0.50, bevel=0.006, segs=2)
    wood.add_beveled_box(0.0, 0.964, -4.795, 1.15, 0.020, 0.045, bevel=0.006, segs=2)
    wood.add_beveled_box(0.0, 0.964, -5.405, 1.15, 0.020, 0.045, bevel=0.006, segs=2)
    wood.add_beveled_box(-0.552, 0.964, -5.10, 0.045, 0.020, 0.57, bevel=0.006, segs=2)
    wood.add_beveled_box(0.552, 0.964, -5.10, 0.045, 0.020, 0.57, bevel=0.006, segs=2)

    # =========================================================================
    # E. LEFT REFRIGERATED GASTRONORM PREP COUNTER (X: -6.15, Y: 0.0..0.955, Z: -2.65)
    #    Upgraded from simple boxes to a full commercial refrigerated prep table with
    #    bullnose profile, raised GN well collar, 4 chiller doors, and adjustable legs!
    # =========================================================================
    left_bullnose_xy = [
        (-6.62, 0.850),
        (-5.65, 0.850),
        (-5.63, 0.862),
        (-5.62, 0.882),
        (-5.63, 0.902),
        (-5.65, 0.915),
        (-6.56, 0.915),
        (-6.58, 0.930),
        (-6.58, 1.030),
        (-6.62, 1.030),
    ]
    steel.add_extruded_profile_z(-4.84, -0.46, left_bullnose_xy, closed=True)

    # Recessed dark iron plinth + 8 cylindrical adjustable stainless legs
    iron.add_beveled_box(-6.14, 0.075, -2.65, 0.86, 0.15, 4.22, bevel=0.01, segs=1)
    for lz in [-4.60, -3.30, -2.00, -0.70]:
        for lx in [-6.48, -5.74]:
            steel.add_lathe_cylinder(
                lx, 0.0, lz,
                [(0.032, 0.0), (0.032, 0.015), (0.020, 0.02), (0.020, 0.15)],
                radial_segs=10, axis="y"
            )

    # Left Stainless Chiller Carcass Body
    steel.add_beveled_box(-6.14, 0.50, -2.65, 0.92, 0.70, 4.32, bevel=0.020, segs=2)

    # Raised Refrigerated Gastronorm (GN) Well Collar & Divider Bars on top of Left Prep Table
    steel.add_beveled_box(-6.10, 0.935, -2.42, 0.68, 0.042, 3.62, bevel=0.010, segs=2)
    iron.add_beveled_box(-6.10, 0.946, -2.42, 0.58, 0.024, 3.48, bevel=0.005, segs=1)

    # 4 Commercial Insulated Stainless Chiller Doors facing X+ (toward kitchen aisle at X = -5.66)
    for d_idx, dz in enumerate([-4.12, -3.14, -2.16, -1.18]):
        iron.add_beveled_box(-5.675, 0.49, dz, 0.025, 0.58, 0.88, bevel=0.006, segs=1)
        steel.add_beveled_box(-5.658, 0.49, dz, 0.034, 0.54, 0.84, bevel=0.014, segs=2)
        hz = dz + (0.30 if d_idx % 2 == 0 else -0.30)
        iron.add_beveled_box(-5.640, 0.53, hz, 0.015, 0.25, 0.060, bevel=0.004, segs=1)
        steel.add_lathe_cylinder(-5.616, 0.40, hz, [(0.010, 0.0), (0.010, 0.25)], radial_segs=10, axis="y")

    # =========================================================================
    # F. SEGMENTED BRUSHED STAINLESS WALL BACKSPLASH PANELS & UTENSIL RAIL
    #    Along Z = -5.69 from X = -6.4 to X = 3.5
    # =========================================================================
    panel_widths = 1.21
    for p_i in range(8):
        px = -5.85 + p_i * 1.24
        steel.add_beveled_box(px, 1.55, -5.70, panel_widths, 0.98, 0.026, bevel=0.010, segs=2)

    # Wall-mounted Magnetic Chef Knife Strip at X = -1.15, Y = 1.62, Z = -5.66
    iron.add_beveled_box(-1.15, 1.62, -5.67, 0.92, 0.055, 0.032, bevel=0.006, segs=1)
    steel.add_beveled_box(-1.15, 1.62, -5.652, 0.88, 0.016, 0.012, bevel=0.003, segs=1)
    for k_i, kx in enumerate([-1.42, -1.18, -0.94]):
        iron.add_beveled_box(kx, 1.72, -5.645, 0.032, 0.12, 0.022, bevel=0.005, segs=1)
        steel.add_beveled_box(kx, 1.53, -5.648, 0.048 - k_i * 0.006, 0.22 - k_i * 0.03, 0.008, bevel=0.002, segs=1)

    # Heavy Stainless Wall Shelf Brackets under the Spice Shelf (X = -4.8, Y = 1.75, Z = -5.58)
    for bx in (-5.65, -4.80, -3.95):
        steel.add_beveled_box(bx, 1.66, -5.58, 0.035, 0.16, 0.26, bevel=0.006, segs=1)

    return [steel, iron, ember, wood, hood_light]


# ---------------------------------------------------------------------------
# 5. Pack Geometry, Tangents & 512x512 PNG Textures into Binary glTF 2.0 (.glb)
# ---------------------------------------------------------------------------

def compile_glb(output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    steel_base, steel_orm, steel_norm = build_stainless_pbr_textures(512)
    iron_base, iron_orm, iron_norm = build_cast_iron_pbr_textures(512)
    wood_base, wood_orm, wood_norm = build_butcher_block_textures(512)

    meshes = build_industrial_kitchen_meshes()

    bin_chunk = bytearray()
    buffer_views = []
    accessors = []
    images = []
    textures = []

    def append_bytes(data: bytes, target: int = None) -> int:
        while len(bin_chunk) % 4 != 0:
            bin_chunk.append(0)
        offset = len(bin_chunk)
        bin_chunk.extend(data)
        while len(bin_chunk) % 4 != 0:
            bin_chunk.append(0)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            bv["target"] = target
        bv_idx = len(buffer_views)
        buffer_views.append(bv)
        return bv_idx

    def add_png_texture(png_bytes: bytes, name: str) -> int:
        bv_idx = append_bytes(png_bytes)
        img_idx = len(images)
        images.append({"name": name, "bufferView": bv_idx, "mimeType": "image/png"})
        tex_idx = len(textures)
        textures.append({"source": img_idx, "sampler": 0})
        return tex_idx

    t_steel_base = add_png_texture(steel_base, "steel_basecolor")
    t_steel_orm = add_png_texture(steel_orm, "steel_orm")
    t_steel_norm = add_png_texture(steel_norm, "steel_normal")

    t_iron_base = add_png_texture(iron_base, "iron_basecolor")
    t_iron_orm = add_png_texture(iron_orm, "iron_orm")
    t_iron_norm = add_png_texture(iron_norm, "iron_normal")

    t_wood_base = add_png_texture(wood_base, "wood_basecolor")
    t_wood_orm = add_png_texture(wood_orm, "wood_orm")
    t_wood_norm = add_png_texture(wood_norm, "wood_normal")

    materials = [
        {
            "name": "BrushedStainlessSteelPBR",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": t_steel_base},
                "metallicRoughnessTexture": {"index": t_steel_orm},
                "metallicFactor": 1.0,
                "roughnessFactor": 1.0,
            },
            "normalTexture": {"index": t_steel_norm, "scale": 0.28},
            "occlusionTexture": {"index": t_steel_orm, "strength": 0.90},
        },
        {
            "name": "SeasonedCastIronPBR",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": t_iron_base},
                "metallicRoughnessTexture": {"index": t_iron_orm},
                "metallicFactor": 1.0,
                "roughnessFactor": 1.0,
            },
            "normalTexture": {"index": t_iron_norm, "scale": 0.60},
            "occlusionTexture": {"index": t_iron_orm, "strength": 0.92},
        },
        {
            "name": "GlowingBurnerEmbersPBR",
            "pbrMetallicRoughness": {
                "baseColorFactor": [1.0, 0.35, 0.05, 1.0],
                "metallicFactor": 0.1,
                "roughnessFactor": 0.35,
            },
            "emissiveFactor": [1.0, 0.32, 0.04],
        },
        {
            "name": "OiledButcherBlockPBR",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": t_wood_base},
                "metallicRoughnessTexture": {"index": t_wood_orm},
                "metallicFactor": 1.0,
                "roughnessFactor": 1.0,
            },
            "normalTexture": {"index": t_wood_norm, "scale": 0.42},
            "occlusionTexture": {"index": t_wood_orm, "strength": 0.90},
        },
        {
            "name": "HoodTaskLightLensPBR",
            "pbrMetallicRoughness": {
                "baseColorFactor": [1.0, 0.95, 0.82, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.15,
            },
            "emissiveFactor": [1.0, 0.86, 0.58],
        },
    ]

    primitives = []
    total_verts = 0
    total_tris = 0

    for mb in meshes:
        if not mb.positions or not mb.indices:
            continue

        total_verts += len(mb.positions)
        total_tris += len(mb.indices) // 3

        pos_bytes = bytearray()
        norm_bytes = bytearray()
        tan_bytes = bytearray()
        uv_bytes = bytearray()
        idx_bytes = bytearray()

        min_x = min(p[0] for p in mb.positions)
        min_y = min(p[1] for p in mb.positions)
        min_z = min(p[2] for p in mb.positions)
        max_x = max(p[0] for p in mb.positions)
        max_y = max(p[1] for p in mb.positions)
        max_z = max(p[2] for p in mb.positions)

        for (px, py, pz) in mb.positions:
            pos_bytes.extend(struct.pack("<fff", px, py, pz))
        for (nx, ny, nz) in mb.normals:
            norm_bytes.extend(struct.pack("<fff", nx, ny, nz))
        for (tx, ty, tz, tw) in mb.tangents:
            tan_bytes.extend(struct.pack("<ffff", tx, ty, tz, tw))
        for (u, v) in mb.uvs:
            uv_bytes.extend(struct.pack("<ff", u, v))
        for idx in mb.indices:
            idx_bytes.extend(struct.pack("<I", idx))

        bv_pos = append_bytes(bytes(pos_bytes), target=34962)
        bv_norm = append_bytes(bytes(norm_bytes), target=34962)
        bv_tan = append_bytes(bytes(tan_bytes), target=34962)
        bv_uv = append_bytes(bytes(uv_bytes), target=34962)
        bv_idx = append_bytes(bytes(idx_bytes), target=34963)

        acc_pos = len(accessors)
        accessors.append({
            "bufferView": bv_pos,
            "componentType": 5126,
            "count": len(mb.positions),
            "type": "VEC3",
            "min": [min_x, min_y, min_z],
            "max": [max_x, max_y, max_z],
        })

        acc_norm = len(accessors)
        accessors.append({
            "bufferView": bv_norm,
            "componentType": 5126,
            "count": len(mb.normals),
            "type": "VEC3",
        })

        acc_tan = len(accessors)
        accessors.append({
            "bufferView": bv_tan,
            "componentType": 5126,
            "count": len(mb.tangents),
            "type": "VEC4",
        })

        acc_uv = len(accessors)
        accessors.append({
            "bufferView": bv_uv,
            "componentType": 5126,
            "count": len(mb.uvs),
            "type": "VEC2",
        })

        acc_idx = len(accessors)
        accessors.append({
            "bufferView": bv_idx,
            "componentType": 5125,
            "count": len(mb.indices),
            "type": "SCALAR",
        })

        primitives.append({
            "attributes": {
                "POSITION": acc_pos,
                "NORMAL": acc_norm,
                "TANGENT": acc_tan,
                "TEXCOORD_0": acc_uv,
                "TEXCOORD_1": acc_uv,
            },
            "indices": acc_idx,
            "material": mb.material_index,
            "mode": 4,
        })

    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "BurgerDistrict Python 3D Asset Compiler v3.0",
        },
        "scene": 0,
        "scenes": [{"name": "IndustrialKitchenScene", "nodes": [0]}],
        "nodes": [{"name": "IndustrialKitchenRoot", "mesh": 0}],
        "meshes": [{"name": "IndustrialKitchenMesh", "primitives": primitives}],
        "materials": materials,
        "textures": textures,
        "images": images,
        "samplers": [
            {
                "magFilter": 9729,
                "minFilter": 9987,
                "wrapS": 10497,
                "wrapT": 10497,
            }
        ],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "buffers": [{"byteLength": len(bin_chunk)}],
    }

    json_bytes = json.dumps(gltf_json, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_chunk)
    glb_header = struct.pack("<III", 0x46546C67, 2, total_length)
    json_header = struct.pack("<II", len(json_bytes), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_chunk), 0x004E4942)

    with open(output_path, "wb") as f:
        f.write(glb_header)
        f.write(json_header)
        f.write(json_bytes)
        f.write(bin_header)
        f.write(bin_chunk)

    print(
        f"[GLB Compiler v3.0] Generated {output_path} ({total_length / 1024:.1f} KB, "
        f"{total_verts} vertices, {total_tris} triangles, {len(primitives)} PBR sub-meshes)"
    )


if __name__ == "__main__":
    compile_glb("public/models/industrial_kitchen.glb")
