use reed_solomon_erasure::galois_8::ReedSolomon;

pub struct CodecECC {
    rs: ReedSolomon,
    data_shards: usize,
    parity_shards: usize,
}

impl CodecECC {
    pub fn new() -> Result<Self, reed_solomon_erasure::Error> {
        let data_shards = 210;
        let parity_shards = 45;
        let rs = ReedSolomon::new(data_shards, parity_shards)?;
        Ok(Self {
            rs,
            data_shards,
            parity_shards,
        })
    }

    pub fn encode(&self, payload: &[u8]) -> Result<Vec<u8>, reed_solomon_erasure::Error> {
        let total_shards = self.data_shards + self.parity_shards;
        let shard_size = ((payload.len() + self.data_shards - 1) / self.data_shards).max(1);
        let mut shards: Vec<Vec<u8>> = Vec::with_capacity(total_shards);

        for i in 0..self.data_shards {
            let start = (i * shard_size).min(payload.len());
            let end = ((i + 1) * shard_size).min(payload.len());
            let mut shard = vec![0u8; shard_size];
            if start < end {
                shard[..(end - start)].copy_from_slice(&payload[start..end]);
            }
            shards.push(shard);
        }
        for _ in 0..self.parity_shards {
            shards.push(vec![0u8; shard_size]);
        }

        self.rs.encode(&mut shards)?;

        let mut ecc_bytes = Vec::with_capacity(self.parity_shards * shard_size);
        for p in &shards[self.data_shards..] {
            ecc_bytes.extend_from_slice(p);
        }
        Ok(ecc_bytes)
    }

    pub fn decode(
        &self,
        mut shards: Vec<Option<Vec<u8>>>,
    ) -> Result<Vec<Vec<u8>>, reed_solomon_erasure::Error> {
        self.rs.reconstruct(&mut shards)?;
        let mut recovered = Vec::with_capacity(self.data_shards);
        for shard in shards.into_iter().take(self.data_shards) {
            recovered.push(shard.unwrap());
        }
        Ok(recovered)
    }
}

// 1-stage 3-axis line parity calculation for fast single-cell error and erasure tagging
pub fn compute_line_parity(symbols: &[u8]) -> Vec<u8> {
    let mut parity = Vec::with_capacity(851);
    for chunk in symbols.chunks(10) {
        let mut acc = 0u8;
        for &s in chunk {
            acc ^= s;
        }
        parity.push(acc & 0b111);
    }
    while parity.len() < 851 {
        parity.push(0);
    }
    parity.truncate(851);
    parity
}
