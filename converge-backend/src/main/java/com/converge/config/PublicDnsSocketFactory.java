package com.converge.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.naming.Context;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.InitialDirContext;
import javax.net.SocketFactory;
import java.io.IOException;
import java.net.*;
import java.time.Instant;
import java.util.Hashtable;
import java.util.concurrent.ConcurrentHashMap;

/**
 * PostgreSQL JDBC SocketFactory that falls back to public DNS resolvers (1.1.1.1 / 8.8.8.8)
 * when the local OS/router DNS fails to resolve the database host (e.g., *.neon.tech).
 * Preserves the original hostname on the resolved {@link InetAddress} so TLS SNI and
 * X.509 certificate hostname verification continue to work normally.
 */
public class PublicDnsSocketFactory extends SocketFactory {

    private static final Logger log = LoggerFactory.getLogger(PublicDnsSocketFactory.class);
    private static final String[] PUBLIC_DNS_SERVERS = {"1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"};
    private static final long DNS_CACHE_TTL_SECONDS = 300L;

    private record CachedIp(byte[] addressBytes, Instant expiresAt) {}

    private static final ConcurrentHashMap<String, CachedIp> RESOLVED_CACHE = new ConcurrentHashMap<>();

    public static InetAddress resolveHost(String host) throws UnknownHostException {
        if (host == null || host.isBlank()) {
            throw new UnknownHostException("Host is blank");
        }
        try {
            return InetAddress.getByName(host);
        } catch (UnknownHostException osEx) {
            CachedIp cached = RESOLVED_CACHE.get(host);
            if (cached != null && Instant.now().isBefore(cached.expiresAt())) {
                return InetAddress.getByAddress(host, cached.addressBytes());
            }

            for (String server : PUBLIC_DNS_SERVERS) {
                try {
                    Hashtable<String, String> env = new Hashtable<>();
                    env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
                    env.put(Context.PROVIDER_URL, "dns://" + server);
                    env.put("com.sun.jndi.dns.timeout.initial", "2000");
                    env.put("com.sun.jndi.dns.timeout.retries", "1");

                    InitialDirContext ctx = new InitialDirContext(env);
                    try {
                        Attributes attrs = ctx.getAttributes(host, new String[]{"A"});
                        Attribute aRecord = attrs.get("A");
                        if (aRecord != null && aRecord.size() > 0) {
                            String ipLiteral = String.valueOf(aRecord.get(0)).trim();
                            byte[] ipBytes = InetAddress.getByName(ipLiteral).getAddress();
                            RESOLVED_CACHE.put(host, new CachedIp(ipBytes, Instant.now().plusSeconds(DNS_CACHE_TTL_SECONDS)));
                            log.info("Resolved database host via public DNS ({})", server);
                            return InetAddress.getByAddress(host, ipBytes);
                        }
                    } finally {
                        try { ctx.close(); } catch (Exception ignored) {}
                    }
                } catch (Exception ignored) {
                    // Try next public DNS server
                }
            }
            throw osEx;
        }
    }

    private static Socket createResolvingSocket() {
        return new Socket() {
            @Override
            public void connect(SocketAddress endpoint, int timeout) throws IOException {
                if (endpoint instanceof InetSocketAddress isa && isa.isUnresolved()) {
                    InetAddress resolved = resolveHost(isa.getHostString());
                    super.connect(new InetSocketAddress(resolved, isa.getPort()), timeout);
                    return;
                }
                super.connect(endpoint, timeout);
            }
        };
    }

    @Override
    public Socket createSocket() {
        return createResolvingSocket();
    }

    @Override
    public Socket createSocket(String host, int port) throws IOException {
        Socket s = createResolvingSocket();
        s.connect(new InetSocketAddress(resolveHost(host), port));
        return s;
    }

    @Override
    public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
        Socket s = createResolvingSocket();
        s.bind(new InetSocketAddress(localHost, localPort));
        s.connect(new InetSocketAddress(resolveHost(host), port));
        return s;
    }

    @Override
    public Socket createSocket(InetAddress host, int port) throws IOException {
        Socket s = createResolvingSocket();
        s.connect(new InetSocketAddress(host, port));
        return s;
    }

    @Override
    public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort) throws IOException {
        Socket s = createResolvingSocket();
        s.bind(new InetSocketAddress(localAddress, localPort));
        s.connect(new InetSocketAddress(address, port));
        return s;
    }
}
