MIN_LENGTH=4
POSITIONS = {
    1: (0, 0),
    2: (0, 1),
    3: (0, 2),
    4: (1, 0),
    5: (1, 1),
    6: (1, 2),
    7: (2, 0),
    8: (2, 1),
    9: (2, 2),
}

NODES = list(POSITIONS.keys())

def precompute_blockers():
    blockers = {}
    for a in NODES:
        for b in NODES:
            if a==b:
                continue
            r1, c1 = POSITIONS[a]
            r2, c2 = POSITIONS[b]
            mid_r = (r1 + r2) / 2
            mid_c = (c1 + c2) / 2

            if mid_r==int(mid_r) and mid_c==int(mid_c):
                for m in NODES:
                    if POSITIONS[m]==(int(mid_r), int(mid_c)):
                        blockers[(a, b)] = m
            else:
                blockers[(a, b)] = None
    return blockers

blockers = precompute_blockers()

def is_valid_next(a, b, visited):
    blocker = blockers[(a, b)]
    if not blocker:
        return True
    return blocker in visited

def dfs(current, visited: set, path: list, all_paths: list):
    for neighbor in NODES:
        if neighbor not in visited and is_valid_next(current, neighbor, visited):
            visited.add(neighbor)
            path.append(neighbor)
            if len(path) >= MIN_LENGTH:
                all_paths.append(path[:])
            
            dfs(neighbor, visited, path, all_paths)

            path.pop()
            visited.remove(neighbor)

def cal_paths():
    all_paths = []    
    for start in NODES:
        visited = {start}
        path = [start]
        dfs(start, visited, path, all_paths)
    return all_paths

def count_path_lengths(all_paths):
    counts_4 = 0
    counts_5 = 0
    counts_6 = 0
    counts_7 = 0
    counts_8 = 0
    counts_9 = 0
    for path in all_paths:
        if len(path)==4: counts_4+=1
        if len(path)==5: counts_5+=1
        if len(path)==6: counts_6+=1
        if len(path)==7: counts_7+=1
        if len(path)==8: counts_8+=1
        if len(path)==9: counts_9+=1
    return [counts_4, counts_5, counts_6, counts_7, counts_8, counts_9,]

all_paths = cal_paths()
counts = count_path_lengths(all_paths)

print(len(all_paths))
print(counts)
