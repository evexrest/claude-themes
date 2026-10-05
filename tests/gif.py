# A tiny animated-GIF writer (no libraries), for making test pictures.
import struct, base64, math

def lzw(pixels, bits):
    clear, end = 1 << bits, (1 << bits) + 1
    out, acc, n = bytearray(), 0, 0
    def emit(code, size):
        nonlocal acc, n
        acc |= code << n; n += size
        while n >= 8:
            out.append(acc & 255); acc >>= 8; n -= 8
    table = {bytes([i]): i for i in range(clear)}
    size, nxt = bits + 1, end + 1
    emit(clear, size)
    cur = b""
    for p in pixels:
        k = cur + bytes([p])
        if k in table:
            cur = k
        else:
            emit(table[cur], size)
            if nxt < 4096:
                table[k] = nxt; nxt += 1
                if nxt > (1 << size) and size < 12: size += 1
            else:
                emit(clear, size)
                table = {bytes([i]): i for i in range(clear)}
                size, nxt = bits + 1, end + 1
            cur = bytes([p])
    emit(table[cur], size); emit(end, size)
    if n: out.append(acc & 255)
    return bytes(out)

def gif(w, h, palette, frames, delay=12, transparent=0):
    pal = list(palette) + [(0, 0, 0)] * (16 - len(palette))
    b = bytearray(b"GIF89a" + struct.pack("<HHBBB", w, h, 0xF3, 0, 0))
    for c in pal: b += bytes(c)
    b += b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"
    for f in frames:
        b += b"\x21\xF9\x04" + bytes([0x09 if transparent is not None else 0x08]) + struct.pack("<H", delay) + bytes([transparent or 0, 0])
        b += b"\x2C" + struct.pack("<HHHHB", 0, 0, w, h, 0) + bytes([4])
        data = lzw(f, 4)
        for i in range(0, len(data), 255):
            chunk = data[i:i + 255]; b += bytes([len(chunk)]) + chunk
        b += b"\x00"
    b += b"\x3B"
    return bytes(b)

def character(i, w=120, h=150):
    # 0 clear, 1 outline, 2 body, 3 white
    px = bytearray(w * h)
    bob = [0, -5, -9, -5, 0, 4][i]; arm = [0, -10, -18, -10, 0, 8][i]
    def disc(cx, cy, r, c):
        for y in range(max(0, cy - r), min(h, cy + r + 1)):
            for x in range(max(0, cx - r), min(w, cx + r + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: px[y * w + x] = c
    def line(x0, y0, x1, y1, c, t=3):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for s in range(n + 1):
            disc(round(x0 + (x1 - x0) * s / n), round(y0 + (y1 - y0) * s / n), t, c)
    line(45, 108 + bob, 40, 142, 1); line(75, 108 + bob, 80, 142, 1)          # legs
    line(92, 78 + bob, 112, 60 + arm, 1); line(28, 78 + bob, 12, 92 + bob, 1)  # arms
    disc(60, 72 + bob, 40, 1); disc(60, 72 + bob, 36, 2)                       # body
    disc(47, 62 + bob, 8, 3); disc(73, 62 + bob, 8, 3); disc(48, 63 + bob, 4, 1); disc(74, 63 + bob, 4, 1)  # eyes
    for a in range(20, 161, 4):                                               # smile
        disc(round(60 + 16 * math.cos(math.radians(a))), round(80 + bob + 12 * math.sin(math.radians(a))), 2, 1)
    return bytes(px)

if __name__ == "__main__":
    pal = [(0, 0, 0), (40, 30, 10), (255, 196, 61), (255, 255, 255)]
    open("char.gif", "wb").write(gif(120, 150, pal, [character(i) for i in range(6)]))
    pal2 = [(0, 0, 0), (30, 20, 60), (150, 120, 255), (255, 255, 255)]
    open("char2.gif", "wb").write(gif(120, 150, pal2, [character(i) for i in (3, 4, 5, 0, 1, 2)]))
    tiny = gif(8, 8, [(255, 0, 0), (0, 0, 255)], [bytes([0] * 64), bytes([1] * 64)], delay=20, transparent=None)
    open("tiny.gif", "wb").write(tiny)
    print(len(open("char.gif", "rb").read()), "bytes; tiny:", base64.b64encode(tiny).decode())
